#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "event.h"

static void trim_newline(char* s) {
    size_t len = strlen(s);
    while (len > 0 && (s[len - 1] == '\n' || s[len - 1] == '\r')) {
        s[len - 1] = '\0';
        len--;
    }
}

static int str_eq_ci_ev(const char* a, const char* b) {
    if (!a || !b) return 0;
    while (*a && *b) {
        if (tolower((unsigned char)*a) != tolower((unsigned char)*b)) {
            return 0;
        }
        a++;
        b++;
    }
    return *a == '\0' && *b == '\0';
}

/* Split pipe-delimited record into fields in-place */
static int split_pipe_fields(char* line, char* fields[], int max_fields) {
    int count = 0;
    char* p = line;
    fields[count++] = p;
    while (*p && count < max_fields) {
        if (*p == '|') {
            *p = '\0';
            fields[count++] = p + 1;
        }
        p++;
    }
    return count;
}

void event_context_init(EventContext* ctx, const char* event_id, const char* event_name) {
    if (!ctx) return;
    snprintf(ctx->event_id, sizeof(ctx->event_id), "%s", event_id ? event_id : "");
    snprintf(ctx->event_name, sizeof(ctx->event_name), "%s", event_name ? event_name : "");
    ctx->volunteers = NULL;
    ctx->tasks = NULL;
    ctx->allocations = NULL;
}

void event_context_free(EventContext* ctx) {
    if (!ctx) return;
    volunteer_free_list(ctx->volunteers);
    task_free_list(ctx->tasks);
    allocation_free_list(ctx->allocations);
    ctx->volunteers = NULL;
    ctx->tasks = NULL;
    ctx->allocations = NULL;
}

int event_load_from_stream(EventContext* ctx, FILE* fp) {
    if (!ctx || !fp) return 0;
    char line[2048];
    char* fields[20];

    while (fgets(line, sizeof(line), fp) != NULL) {
        trim_newline(line);
        if (line[0] == '\0') continue;

        int n = split_pipe_fields(line, fields, 20);
        if (n <= 0) continue;

        if (strcmp(fields[0], "EVENT") == 0 && n >= 3) {
            snprintf(ctx->event_id, sizeof(ctx->event_id), "%s", fields[1]);
            snprintf(ctx->event_name, sizeof(ctx->event_name), "%s", fields[2]);
        } else if (strcmp(fields[0], "VOL") == 0 && n >= 13) {
            VolunteerNode* v = volunteer_create(
                fields[1], fields[2], fields[3], fields[4],
                fields[5], fields[6], fields[7], fields[8],
                fields[9], fields[10], fields[11], atof(fields[12])
            );
            volunteer_insert(&ctx->volunteers, v);
        } else if (strcmp(fields[0], "TASK") == 0 && n >= 15) {
            TaskNode* t = task_create(
                fields[1], fields[2], fields[3], fields[4],
                fields[5], atoi(fields[6]), atoi(fields[7]), atoi(fields[8]),
                fields[9], fields[10], atof(fields[11]),
                fields[12], fields[13], fields[14]
            );
            task_insert(&ctx->tasks, t);
        } else if (strcmp(fields[0], "ALLOC") == 0 && n >= 11) {
            AllocationNode* a = allocation_create(
                fields[1], fields[2], fields[3], fields[4],
                atof(fields[5]), atof(fields[6]),
                atof(fields[7]), atof(fields[8]),
                fields[9], fields[10]
            );
            allocation_insert(&ctx->allocations, a);
        }
    }
    return 1;
}

void json_print_escaped(const char* str) {
    putchar('"');
    if (str) {
        for (const char* p = str; *p; p++) {
            unsigned char c = (unsigned char)*p;
            switch (c) {
                case '"': printf("\\\""); break;
                case '\\': printf("\\\\"); break;
                case '\b': printf("\\b"); break;
                case '\f': printf("\\f"); break;
                case '\n': printf("\\n"); break;
                case '\r': printf("\\r"); break;
                case '\t': printf("\\t"); break;
                default:
                    if (c < 0x20) {
                        printf("\\u%04x", c);
                    } else {
                        putchar(c);
                    }
            }
        }
    }
    putchar('"');
}

static int count_active_for_task(VolunteerNode* volunteers, const char* task_id) {
    int count = 0;
    VolunteerNode* v = volunteers;
    while (v != NULL) {
        if (strcmp(v->assigned_task_id, task_id) == 0 &&
            (str_eq_ci_ev(v->status, "Working") ||
             str_eq_ci_ev(v->status, "Assigned") ||
             str_eq_ci_ev(v->status, "Reassignment Requested"))) {
            count++;
        }
        v = v->next;
    }
    return count;
}

static int count_working_for_task(VolunteerNode* volunteers, const char* task_id) {
    int count = 0;
    VolunteerNode* v = volunteers;
    while (v != NULL) {
        if (strcmp(v->assigned_task_id, task_id) == 0 &&
            str_eq_ci_ev(v->status, "Working")) {
            count++;
        }
        v = v->next;
    }
    return count;
}

void event_output_live_stats_json(const EventContext* ctx) {
    int total_registered = 0;
    int currently_working = 0;
    int available_volunteers = 0;
    int assigned_volunteers = 0;
    int completed_volunteers = 0;
    int unavailable_volunteers = 0;
    int reassignment_requested = 0;

    VolunteerNode* v = ctx->volunteers;
    while (v != NULL) {
        total_registered++;
        if (str_eq_ci_ev(v->status, "Working")) {
            currently_working++;
        } else if (str_eq_ci_ev(v->status, "Available")) {
            if (!str_eq_ci_ev(v->availability, "Unavailable")) {
                available_volunteers++;
            } else {
                unavailable_volunteers++;
            }
        } else if (str_eq_ci_ev(v->status, "Assigned")) {
            assigned_volunteers++;
        } else if (str_eq_ci_ev(v->status, "Completed")) {
            completed_volunteers++;
        } else if (str_eq_ci_ev(v->status, "Unavailable")) {
            unavailable_volunteers++;
        } else if (str_eq_ci_ev(v->status, "Reassignment Requested")) {
            reassignment_requested++;
        }
        v = v->next;
    }

    int tasks_completed = 0;
    int tasks_in_progress = 0;
    int tasks_requiring_volunteers = 0;
    int total_volunteers_needed = 0;
    int fully_staffed_count = 0;
    int understaffed_count = 0;
    int overstaffed_count = 0;
    int unassigned_count = 0;

    printf("{\n");
    printf("  \"engine\": \"c_linked_list_engine\",\n");
    printf("  \"eventId\": "); json_print_escaped(ctx->event_id); printf(",\n");
    printf("  \"eventName\": "); json_print_escaped(ctx->event_name); printf(",\n");

    printf("  \"taskStaffing\": [\n");
    TaskNode* t = ctx->tasks;
    int first = 1;
    while (t != NULL) {
        if (ctx->event_id[0] == '\0' || strcmp(t->event_id, ctx->event_id) == 0) {
            int active = count_active_for_task(ctx->volunteers, t->id);
            int working = count_working_for_task(ctx->volunteers, t->id);
            int needed = 0;
            int excess = 0;
            const char* staffing_state = "Fully Staffed";

            if (str_eq_ci_ev(t->status, "Completed")) {
                tasks_completed++;
                staffing_state = "Completed";
            } else {
                if (active < t->required_volunteers) {
                    needed = t->required_volunteers - active;
                    total_volunteers_needed += needed;
                    tasks_requiring_volunteers++;
                    understaffed_count++;
                    if (active == 0) {
                        unassigned_count++;
                        staffing_state = "Unassigned";
                    } else {
                        staffing_state = "Understaffed";
                    }
                } else if (active > t->required_volunteers) {
                    excess = active - t->required_volunteers;
                    overstaffed_count++;
                    staffing_state = "Overstaffed";
                } else {
                    fully_staffed_count++;
                    staffing_state = "Fully Staffed";
                }

                if (str_eq_ci_ev(t->status, "In Progress") || working > 0) {
                    tasks_in_progress++;
                }
            }

            if (!first) printf(",\n");
            first = 0;
            printf("    {\n");
            printf("      \"taskId\": "); json_print_escaped(t->id); printf(",\n");
            printf("      \"taskName\": "); json_print_escaped(t->name); printf(",\n");
            printf("      \"priority\": "); json_print_escaped(t->priority); printf(",\n");
            printf("      \"location\": "); json_print_escaped(t->location); printf(",\n");
            printf("      \"status\": "); json_print_escaped(t->status); printf(",\n");
            printf("      \"staffingState\": "); json_print_escaped(staffing_state); printf(",\n");
            printf("      \"required\": %d,\n", t->required_volunteers);
            printf("      \"assignedActive\": %d,\n", active);
            printf("      \"working\": %d,\n", working);
            printf("      \"needed\": %d,\n", needed);
            printf("      \"excess\": %d\n", excess);
            printf("    }");
        }
        t = t->next;
    }
    printf("\n  ],\n");

    printf("  \"summary\": {\n");
    printf("    \"totalRegisteredVolunteers\": %d,\n", total_registered);
    printf("    \"currentlyWorking\": %d,\n", currently_working);
    printf("    \"availableVolunteers\": %d,\n", available_volunteers);
    printf("    \"assignedVolunteers\": %d,\n", assigned_volunteers);
    printf("    \"completedVolunteers\": %d,\n", completed_volunteers);
    printf("    \"unavailableVolunteers\": %d,\n", unavailable_volunteers);
    printf("    \"reassignmentRequested\": %d,\n", reassignment_requested);
    printf("    \"tasksCompleted\": %d,\n", tasks_completed);
    printf("    \"tasksInProgress\": %d,\n", tasks_in_progress);
    printf("    \"tasksRequiringVolunteers\": %d,\n", tasks_requiring_volunteers);
    printf("    \"totalVolunteersNeeded\": %d,\n", total_volunteers_needed);
    printf("    \"fullyStaffedTasks\": %d,\n", fully_staffed_count);
    printf("    \"understaffedTasks\": %d,\n", understaffed_count);
    printf("    \"overstaffedTasks\": %d,\n", overstaffed_count);
    printf("    \"unassignedTasks\": %d\n", unassigned_count);
    printf("  }\n");
    printf("}\n");
}

void event_output_recommend_json(const EventContext* ctx, const char* task_id) {
    TaskNode* task = task_search(ctx->tasks, task_id);
    if (!task) {
        printf("{\"error\": \"Task not found in Task Linked List\", \"candidates\": []}\n");
        return;
    }

    CandidateMatch top3[3];
    int count = find_top_candidates_for_task(
        ctx->volunteers,
        ctx->allocations,
        task,
        top3,
        3
    );

    printf("{\n");
    printf("  \"engine\": \"c_weighted_scoring_bubble_sort\",\n");
    printf("  \"taskId\": "); json_print_escaped(task->id); printf(",\n");
    printf("  \"taskName\": "); json_print_escaped(task->name); printf(",\n");
    printf("  \"requiredSkills\": "); json_print_escaped(task->required_skills); printf(",\n");
    printf("  \"candidateCount\": %d,\n", count);
    printf("  \"candidates\": [\n");
    for (int i = 0; i < count; i++) {
        printf("    {\n");
        printf("      \"rank\": %d,\n", i + 1);
        printf("      \"volunteerId\": "); json_print_escaped(top3[i].volunteer_id); printf(",\n");
        printf("      \"volunteerName\": "); json_print_escaped(top3[i].volunteer_name); printf(",\n");
        printf("      \"skills\": "); json_print_escaped(top3[i].skills); printf(",\n");
        printf("      \"matchedSkills\": "); json_print_escaped(top3[i].matched_skills); printf(",\n");
        printf("      \"matchedCount\": %d,\n", top3[i].matched_count);
        printf("      \"requiredCount\": %d,\n", top3[i].required_count);
        printf("      \"preferredMatch\": %s,\n", top3[i].preferred_match ? "true" : "false");
        printf("      \"currentWorkload\": %.2f,\n", top3[i].current_workload);
        printf("      \"compatibilityScore\": %.2f,\n", top3[i].compatibility_score);
        printf("      \"loadPreference\": %.2f,\n", top3[i].load_preference);
        printf("      \"finalScore\": %.2f,\n", top3[i].final_score);
        printf("      \"explanation\": "); json_print_escaped(top3[i].explanation); printf("\n");
        printf("    }%s\n", (i < count - 1) ? "," : "");
    }
    printf("  ]\n");
    printf("}\n");
}

void event_output_allocate_check_json(
    const EventContext* ctx,
    const char* volunteer_id,
    const char* task_id
) {
    VolunteerNode* v = volunteer_search(ctx->volunteers, volunteer_id);
    TaskNode* t = task_search(ctx->tasks, task_id);

    if (!v || !t) {
        printf("{\"allowed\": false, \"reason\": \"Volunteer or task record not found in linked list.\"}\n");
        return;
    }

    if (allocation_exists_active(ctx->allocations, volunteer_id, task_id)) {
        printf("{\"allowed\": false, \"reason\": \"Duplicate allocation prevented by Allocation Linked List check.\"}\n");
        return;
    }

    if (str_eq_ci_ev(v->availability, "Unavailable") ||
        (!str_eq_ci_ev(v->status, "Available") && !str_eq_ci_ev(v->status, "Completed"))) {
        printf("{\"allowed\": false, \"reason\": \"Volunteer is not currently available for new assignment.\"}\n");
        return;
    }

    char matched_skills[256];
    int matched_cnt = 0;
    int req_cnt = 0;
    match_skills(t->required_skills, v->skills, matched_skills, &matched_cnt, &req_cnt);

    double compat = 0.0, load_pref = 0.0, final_score = 0.0;
    calculate_weighted_score(matched_cnt, req_cnt, v->current_workload, &compat, &load_pref, &final_score);

    double prev_workload = v->current_workload;
    double updated_workload = prev_workload + t->duration_hours;

    printf("{\n");
    printf("  \"allowed\": true,\n");
    printf("  \"volunteerId\": "); json_print_escaped(v->id); printf(",\n");
    printf("  \"volunteerName\": "); json_print_escaped(v->name); printf(",\n");
    printf("  \"taskId\": "); json_print_escaped(t->id); printf(",\n");
    printf("  \"taskName\": "); json_print_escaped(t->name); printf(",\n");
    printf("  \"matchedSkills\": "); json_print_escaped(matched_cnt > 0 ? matched_skills : "General"); printf(",\n");
    printf("  \"compatibilityScore\": %.2f,\n", compat);
    printf("  \"loadPreference\": %.2f,\n", load_pref);
    printf("  \"finalScore\": %.2f,\n", final_score);
    printf("  \"previousWorkload\": %.2f,\n", prev_workload);
    printf("  \"updatedWorkload\": %.2f\n", updated_workload);
    printf("}\n");
}

/* Algorithm 5 & 6: FIFO Task Processing + Workload Optimization */
void event_output_optimize_json(const EventContext* ctx) {
    Queue* fifo_queue = queue_create();
    TaskNode* t = ctx->tasks;

    /* Enqueue all understaffed non-completed tasks in FIFO order */
    while (t != NULL) {
        if ((ctx->event_id[0] == '\0' || strcmp(t->event_id, ctx->event_id) == 0) &&
            !str_eq_ci_ev(t->status, "Completed")) {
            int active = count_active_for_task(ctx->volunteers, t->id);
            if (active < t->required_volunteers) {
                queue_enqueue(fifo_queue, t->id, t->required_volunteers - active, t->priority);
            }
        }
        t = t->next;
    }

    printf("{\n");
    printf("  \"engine\": \"c_fifo_queue_and_workload_balancer\",\n");
    printf("  \"queueSize\": %d,\n", fifo_queue->size);
    printf("  \"understaffedRecommendations\": [\n");

    int first_rec = 1;
    char task_id[32];
    int deficit = 0;
    char prio[32];

    while (queue_dequeue(fifo_queue, task_id, &deficit, prio)) {
        TaskNode* task = task_search(ctx->tasks, task_id);
        if (!task) continue;

        CandidateMatch top3[3];
        int cand_count = find_top_candidates_for_task(
            ctx->volunteers,
            ctx->allocations,
            task,
            top3,
            3
        );

        int active = count_active_for_task(ctx->volunteers, task->id);
        int working = count_working_for_task(ctx->volunteers, task->id);

        if (!first_rec) printf(",\n");
        first_rec = 0;

        printf("    {\n");
        printf("      \"taskId\": "); json_print_escaped(task->id); printf(",\n");
        printf("      \"taskName\": "); json_print_escaped(task->name); printf(",\n");
        printf("      \"priority\": "); json_print_escaped(prio); printf(",\n");
        printf("      \"required\": %d,\n", task->required_volunteers);
        printf("      \"currentlyWorking\": %d,\n", working);
        printf("      \"currentlyActive\": %d,\n", active);
        printf("      \"needed\": %d,\n", deficit);
        printf("      \"recommendedVolunteers\": [\n");
        for (int i = 0; i < cand_count; i++) {
            printf("        {\n");
            printf("          \"rank\": %d,\n", i + 1);
            printf("          \"volunteerId\": "); json_print_escaped(top3[i].volunteer_id); printf(",\n");
            printf("          \"volunteerName\": "); json_print_escaped(top3[i].volunteer_name); printf(",\n");
            printf("          \"matchedSkills\": "); json_print_escaped(top3[i].matched_skills); printf(",\n");
            printf("          \"currentWorkload\": %.2f,\n", top3[i].current_workload);
            printf("          \"compatibilityScore\": %.2f,\n", top3[i].compatibility_score);
            printf("          \"finalScore\": %.2f,\n", top3[i].final_score);
            printf("          \"explanation\": "); json_print_escaped(top3[i].explanation); printf("\n");
            printf("        }%s\n", (i < cand_count - 1) ? "," : "");
        }
        printf("      ]\n");
        printf("    }");
    }
    printf("\n  ],\n");

    /* Identify overstaffed tasks (advisory only; never auto-remove) */
    printf("  \"overstaffedTasks\": [\n");
    t = ctx->tasks;
    int first_over = 1;
    while (t != NULL) {
        if ((ctx->event_id[0] == '\0' || strcmp(t->event_id, ctx->event_id) == 0) &&
            !str_eq_ci_ev(t->status, "Completed")) {
            int active = count_active_for_task(ctx->volunteers, t->id);
            if (active > t->required_volunteers) {
                if (!first_over) printf(",\n");
                first_over = 0;
                printf("    {\n");
                printf("      \"taskId\": "); json_print_escaped(t->id); printf(",\n");
                printf("      \"taskName\": "); json_print_escaped(t->name); printf(",\n");
                printf("      \"required\": %d,\n", t->required_volunteers);
                printf("      \"assignedActive\": %d,\n", active);
                printf("      \"excess\": %d\n", active - t->required_volunteers);
                printf("    }");
            }
        }
        t = t->next;
    }
    printf("\n  ]\n");
    printf("}\n");

    queue_free(fifo_queue);
}

void event_output_analytics_json(const EventContext* ctx) {
    int total_vol = 0;
    double sum_workload = 0.0;
    int underutilized = 0;
    int balanced = 0;
    int overloaded = 0;

    printf("{\n");
    printf("  \"engine\": \"c_workload_balancer_analytics\",\n");
    printf("  \"volunteerWorkloads\": [\n");

    VolunteerNode* v = ctx->volunteers;
    int first_v = 1;
    while (v != NULL) {
        total_vol++;
        sum_workload += v->current_workload;
        const char* category = "Balanced";
        if (v->current_workload < 4.0) {
            underutilized++;
            category = "Underutilized";
        } else if (v->current_workload >= 10.0) {
            overloaded++;
            category = "Overloaded";
        } else {
            balanced++;
            category = "Balanced";
        }

        /* Find initial workload from earliest allocation if any, or current if none */
        double before_workload = v->current_workload;
        AllocationNode* a = ctx->allocations;
        while (a != NULL) {
            if (strcmp(a->volunteer_id, v->id) == 0) {
                before_workload = a->previous_workload;
                break;
            }
            a = a->next;
        }

        if (!first_v) printf(",\n");
        first_v = 0;
        printf("    {\n");
        printf("      \"volunteerId\": "); json_print_escaped(v->id); printf(",\n");
        printf("      \"name\": "); json_print_escaped(v->name); printf(",\n");
        printf("      \"status\": "); json_print_escaped(v->status); printf(",\n");
        printf("      \"currentWorkload\": %.2f,\n", v->current_workload);
        printf("      \"beforeAllocationWorkload\": %.2f,\n", before_workload);
        printf("      \"category\": "); json_print_escaped(category); printf("\n");
        printf("    }");
        v = v->next;
    }
    printf("\n  ],\n");

    double avg_workload = total_vol > 0 ? (sum_workload / (double)total_vol) : 0.0;

    printf("  \"taskDistribution\": [\n");
    TaskNode* t = ctx->tasks;
    int first_t = 1;
    while (t != NULL) {
        if (ctx->event_id[0] == '\0' || strcmp(t->event_id, ctx->event_id) == 0) {
            int active = count_active_for_task(ctx->volunteers, t->id);
            if (!first_t) printf(",\n");
            first_t = 0;
            printf("    {\n");
            printf("      \"taskId\": "); json_print_escaped(t->id); printf(",\n");
            printf("      \"taskName\": "); json_print_escaped(t->name); printf(",\n");
            printf("      \"required\": %d,\n", t->required_volunteers);
            printf("      \"assigned\": %d,\n", active);
            printf("      \"durationHours\": %.2f\n", t->duration_hours);
            printf("    }");
        }
        t = t->next;
    }
    printf("\n  ],\n");

    printf("  \"summary\": {\n");
    printf("    \"totalVolunteers\": %d,\n", total_vol);
    printf("    \"averageWorkload\": %.2f,\n", avg_workload);
    printf("    \"underutilizedCount\": %d,\n", underutilized);
    printf("    \"balancedCount\": %d,\n", balanced);
    printf("    \"overloadedCount\": %d\n", overloaded);
    printf("  }\n");
    printf("}\n");
}
