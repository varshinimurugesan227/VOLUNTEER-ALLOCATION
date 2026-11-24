#include "allocation.h"
#include <ctype.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void safe_copy(char* dest, const char* src, size_t max_len) {
    if (!src) {
        dest[0] = '\0';
        return;
    }
    snprintf(dest, max_len, "%s", src);
}

static void trim_and_lower(const char* src, char* dest, size_t max_len) {
    if (!src || max_len == 0) {
        if (max_len > 0) dest[0] = '\0';
        return;
    }
    while (*src && isspace((unsigned char)*src)) {
        src++;
    }
    size_t len = strlen(src);
    while (len > 0 && isspace((unsigned char)src[len - 1])) {
        len--;
    }
    size_t i = 0;
    for (i = 0; i < len && i < max_len - 1; i++) {
        dest[i] = (char)tolower((unsigned char)src[i]);
    }
    dest[i] = '\0';
}

static int str_eq_ci(const char* a, const char* b) {
    char la[128], lb[128];
    trim_and_lower(a, la, sizeof(la));
    trim_and_lower(b, lb, sizeof(lb));
    return strcmp(la, lb) == 0;
}

static int str_contains_ci(const char* haystack, const char* needle) {
    char lh[256], ln[128];
    trim_and_lower(haystack, lh, sizeof(lh));
    trim_and_lower(needle, ln, sizeof(ln));
    if (ln[0] == '\0') return 0;
    return strstr(lh, ln) != NULL;
}

static int split_tokens(const char* csv, char tokens[][64], int max_tokens) {
    if (!csv || csv[0] == '\0') {
        return 0;
    }
    char buf[256];
    safe_copy(buf, csv, sizeof(buf));
    int count = 0;
    char* start = buf;
    while (start && *start && count < max_tokens) {
        char* comma = strchr(start, ',');
        if (comma) {
            *comma = '\0';
        }
        char cleaned[64];
        trim_and_lower(start, cleaned, sizeof(cleaned));
        if (cleaned[0] != '\0') {
            safe_copy(tokens[count], cleaned, 64);
            count++;
        }
        if (comma) {
            start = comma + 1;
        } else {
            break;
        }
    }
    return count;
}

AllocationNode* allocation_create(
    const char* id,
    const char* event_id,
    const char* volunteer_id,
    const char* task_id,
    double compatibility_score,
    double final_score,
    double previous_workload,
    double updated_workload,
    const char* matched_skills,
    const char* status
) {
    AllocationNode* node = (AllocationNode*)malloc(sizeof(AllocationNode));
    if (!node) {
        return NULL;
    }
    safe_copy(node->id, id, 32);
    safe_copy(node->event_id, event_id, 32);
    safe_copy(node->volunteer_id, volunteer_id, 32);
    safe_copy(node->task_id, task_id, 32);
    node->compatibility_score = compatibility_score;
    node->final_score = final_score;
    node->previous_workload = previous_workload;
    node->updated_workload = updated_workload;
    safe_copy(node->matched_skills, matched_skills, 256);
    safe_copy(node->status, status, 32);
    node->next = NULL;
    return node;
}

void allocation_insert(AllocationNode** head, AllocationNode* node) {
    if (!head || !node) {
        return;
    }
    if (*head == NULL) {
        *head = node;
        return;
    }
    AllocationNode* curr = *head;
    while (curr->next != NULL) {
        curr = curr->next;
    }
    curr->next = node;
}

AllocationNode* allocation_search(
    AllocationNode* head,
    const char* volunteer_id,
    const char* task_id
) {
    AllocationNode* curr = head;
    while (curr != NULL) {
        if (strcmp(curr->volunteer_id, volunteer_id) == 0 &&
            strcmp(curr->task_id, task_id) == 0) {
            return curr;
        }
        curr = curr->next;
    }
    return NULL;
}

int allocation_exists_active(
    AllocationNode* head,
    const char* volunteer_id,
    const char* task_id
) {
    AllocationNode* curr = head;
    while (curr != NULL) {
        if (strcmp(curr->volunteer_id, volunteer_id) == 0 &&
            strcmp(curr->task_id, task_id) == 0 &&
            (str_eq_ci(curr->status, "Assigned") || str_eq_ci(curr->status, "Working"))) {
            return 1;
        }
        curr = curr->next;
    }
    return 0;
}

void allocation_free_list(AllocationNode* head) {
    AllocationNode* curr = head;
    while (curr != NULL) {
        AllocationNode* next = curr->next;
        free(curr);
        curr = next;
    }
}

/* Algorithm 1: Skill Matching Algorithm */
int match_skills(
    const char* required_skills,
    const char* volunteer_skills,
    char* out_matched_skills,
    int* out_matched_count,
    int* out_required_count
) {
    char req_tokens[16][64];
    char vol_tokens[16][64];
    int req_n = split_tokens(required_skills, req_tokens, 16);
    int vol_n = split_tokens(volunteer_skills, vol_tokens, 16);

    int matched = 0;
    out_matched_skills[0] = '\0';

    for (int i = 0; i < req_n; i++) {
        int found = 0;
        for (int j = 0; j < vol_n; j++) {
            if (strcmp(req_tokens[i], vol_tokens[j]) == 0 ||
                strstr(vol_tokens[j], req_tokens[i]) != NULL ||
                strstr(req_tokens[i], vol_tokens[j]) != NULL) {
                found = 1;
                break;
            }
        }
        if (found) {
            if (matched > 0) {
                strncat(out_matched_skills, ", ", 255 - strlen(out_matched_skills));
            }
            strncat(out_matched_skills, req_tokens[i], 255 - strlen(out_matched_skills));
            matched++;
        }
    }

    if (out_matched_count) *out_matched_count = matched;
    if (out_required_count) *out_required_count = req_n;
    return matched;
}

int check_preferred_task(const char* preferred_tasks, const char* task_name, const char* task_id) {
    if (!preferred_tasks || preferred_tasks[0] == '\0') {
        return 0;
    }
    if (str_contains_ci(preferred_tasks, task_name) || str_contains_ci(preferred_tasks, task_id)) {
        return 1;
    }
    return 0;
}

/* Algorithm 2: Weighted Scoring Algorithm */
void calculate_weighted_score(
    int matched_count,
    int required_count,
    double current_workload,
    double* out_compatibility_score,
    double* out_load_preference,
    double* out_final_score
) {
    double compatibility = 0.0;
    if (required_count > 0) {
        compatibility = ((double)matched_count / (double)required_count) * 100.0;
    } else {
        compatibility = 100.0;
    }
    if (compatibility > 100.0) {
        compatibility = 100.0;
    }

    double load_pref = 100.0 / (1.0 + (current_workload >= 0.0 ? current_workload : 0.0));
    double final_score = (0.7 * compatibility) + (0.3 * load_pref);

    if (out_compatibility_score) *out_compatibility_score = compatibility;
    if (out_load_preference) *out_load_preference = load_pref;
    if (out_final_score) *out_final_score = final_score;
}

/* Algorithm 3: Bubble Sort for Candidate Ranking (Descending Final Score) */
void bubble_sort_candidates(CandidateMatch candidates[], int count) {
    for (int i = 0; i < count - 1; i++) {
        int swapped = 0;
        for (int j = 0; j < count - i - 1; j++) {
            int should_swap = 0;
            double diff = candidates[j + 1].final_score - candidates[j].final_score;
            if (diff > 0.001) {
                should_swap = 1;
            } else if (fabs(diff) <= 0.001) {
                if (candidates[j + 1].preferred_match > candidates[j].preferred_match) {
                    should_swap = 1;
                } else if (candidates[j + 1].preferred_match == candidates[j].preferred_match &&
                           candidates[j + 1].current_workload < candidates[j].current_workload) {
                    should_swap = 1;
                }
            }
            if (should_swap) {
                CandidateMatch temp = candidates[j];
                candidates[j] = candidates[j + 1];
                candidates[j + 1] = temp;
                swapped = 1;
            }
        }
        if (!swapped) {
            break;
        }
    }
}

static int is_volunteer_eligible(VolunteerNode* v, AllocationNode* allocations, const TaskNode* task) {
    if (!v || !task) {
        return 0;
    }
    if (str_eq_ci(v->availability, "Unavailable")) {
        return 0;
    }
    /* Only volunteers who are Available or Completed (released) can take new assignments */
    if (!str_eq_ci(v->status, "Available") && !str_eq_ci(v->status, "Completed")) {
        return 0;
    }
    /* Prevent duplicate active allocations */
    if (allocation_exists_active(allocations, v->id, task->id)) {
        return 0;
    }
    return 1;
}

/* Algorithm 4: Greedy Candidate Evaluation + Top-N Ranked Selection */
int find_top_candidates_for_task(
    VolunteerNode* volunteers,
    AllocationNode* allocations,
    const TaskNode* task,
    CandidateMatch out_candidates[],
    int max_results
) {
    CandidateMatch pool[MAX_CANDIDATES];
    int pool_count = 0;

    VolunteerNode* curr = volunteers;
    while (curr != NULL && pool_count < MAX_CANDIDATES) {
        if (is_volunteer_eligible(curr, allocations, task)) {
            char matched_skills[256];
            int matched_cnt = 0;
            int req_cnt = 0;

            match_skills(task->required_skills, curr->skills, matched_skills, &matched_cnt, &req_cnt);

            /* Require at least 1 matched skill when the task defines required skills */
            if (req_cnt == 0 || matched_cnt > 0) {
                CandidateMatch cand;
                memset(&cand, 0, sizeof(CandidateMatch));
                safe_copy(cand.volunteer_id, curr->id, 32);
                safe_copy(cand.volunteer_name, curr->name, 128);
                safe_copy(cand.email, curr->email, 128);
                safe_copy(cand.skills, curr->skills, 256);
                safe_copy(cand.matched_skills, matched_cnt > 0 ? matched_skills : "None", 256);
                cand.matched_count = matched_cnt;
                cand.required_count = req_cnt;
                cand.preferred_match = check_preferred_task(curr->preferred_tasks, task->name, task->id);
                cand.current_workload = curr->current_workload;

                calculate_weighted_score(
                    matched_cnt,
                    req_cnt,
                    curr->current_workload,
                    &cand.compatibility_score,
                    &cand.load_preference,
                    &cand.final_score
                );

                snprintf(
                    cand.explanation,
                    sizeof(cand.explanation),
                    "Matched %d/%d required skills (%s) for %.1f%% compatibility; %.1fh current workload yields %.1f load preference%s.",
                    matched_cnt,
                    req_cnt,
                    matched_cnt > 0 ? matched_skills : "general",
                    cand.compatibility_score,
                    curr->current_workload,
                    cand.load_preference,
                    cand.preferred_match ? "; aligns with volunteer preferred task" : ""
                );

                pool[pool_count++] = cand;
            }
        }
        curr = curr->next;
    }

    if (pool_count == 0) {
        return 0;
    }

    bubble_sort_candidates(pool, pool_count);

    int limit = pool_count < max_results ? pool_count : max_results;
    for (int i = 0; i < limit; i++) {
        out_candidates[i] = pool[i];
    }
    return limit;
}

int greedy_select_best(
    VolunteerNode* volunteers,
    AllocationNode* allocations,
    const TaskNode* task,
    CandidateMatch* out_best
) {
    CandidateMatch top[1];
    int found = find_top_candidates_for_task(volunteers, allocations, task, top, 1);
    if (found > 0 && out_best) {
        *out_best = top[0];
        return 1;
    }
    return 0;
}
