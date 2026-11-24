#include <math.h>
#include <stdio.h>
#include <string.h>
#include "volunteer.h"
#include "task.h"
#include "queue.h"
#include "allocation.h"
#include "event.h"

static void print_test_result(
    const char* id,
    const char* title,
    const char* data_structures,
    const char* details,
    int passed,
    int is_last
) {
    printf("    {\n");
    printf("      \"id\": "); json_print_escaped(id); printf(",\n");
    printf("      \"title\": "); json_print_escaped(title); printf(",\n");
    printf("      \"dataStructures\": "); json_print_escaped(data_structures); printf(",\n");
    printf("      \"details\": "); json_print_escaped(details); printf(",\n");
    printf("      \"status\": \"%s\",\n", passed ? "PASS" : "FAIL");
    printf("      \"passed\": %s\n", passed ? "true" : "false");
    printf("    }%s\n", is_last ? "" : ",");
}

/* TC01: Volunteer Registration (Insertion, Search, Availability Update, Deletion) */
static int run_tc01(char* details, size_t details_len) {
    VolunteerNode* head = NULL;
    volunteer_insert(&head, volunteer_create(
        "VOL-901", "Aarav Menon", "aarav@campus.edu", "9876543210",
        "Technical Support", "Networking, Audio, Linux", "2 events",
        "Available", "Morning", "Available", "", 0.0
    ));
    volunteer_insert(&head, volunteer_create(
        "VOL-902", "Priya Nair", "priya@campus.edu", "9876543211",
        "Registration Management", "Communication, Excel, Desk", "1 event",
        "Available", "Full Day", "Available", "", 2.0
    ));

    int cnt_before = volunteer_count(head);
    VolunteerNode* found = volunteer_search(head, "VOL-901");
    int updated = volunteer_update_availability(head, "VOL-902", "Limited", "Available");
    int deleted = volunteer_delete(&head, "VOL-902");
    int cnt_after = volunteer_count(head);

    int ok = (cnt_before == 2 && found != NULL &&
              strcmp(found->name, "Aarav Menon") == 0 &&
              updated == 1 && deleted == 1 && cnt_after == 1);

    snprintf(
        details, details_len,
        "Inserted 2 nodes into Volunteer Singly Linked List; searched VOL-901 (%s); updated & deleted VOL-902; final node count = %d.",
        found ? found->name : "NULL", cnt_after
    );

    volunteer_free_list(head);
    return ok;
}

/* TC02: Successful Skill Matching + Weighted Scoring + Bubble Sort Top-3 Ranking */
static int run_tc02(char* details, size_t details_len) {
    VolunteerNode* vols = NULL;
    volunteer_insert(&vols, volunteer_create(
        "VOL-201", "Kiran Rao", "kiran@campus.edu", "900001",
        "Technical Support", "Networking, AV Setup, Troubleshooting", "3 events",
        "Available", "Morning", "Available", "", 0.0
    ));
    volunteer_insert(&vols, volunteer_create(
        "VOL-202", "Sneha Iyer", "sneha@campus.edu", "900002",
        "Stage Management", "AV Setup, Coordination", "2 events",
        "Available", "Morning", "Available", "", 4.0
    ));
    volunteer_insert(&vols, volunteer_create(
        "VOL-203", "Rohan Das", "rohan@campus.edu", "900003",
        "Technical Support", "Networking", "1 event",
        "Available", "Afternoon", "Available", "", 1.0
    ));

    TaskNode* task = task_create(
        "TSK-201", "EVT-1", "Technical Support", "Manage stage AV and Wi-Fi",
        "Networking, AV Setup, Troubleshooting", 2, 0, 0,
        "High", "Main Auditorium", 4.0, "09:00", "13:00", "Needs Volunteers"
    );

    CandidateMatch top3[3];
    int n = find_top_candidates_for_task(vols, NULL, task, top3, 3);

    /* VOL-201 matches 3/3 (100% compat) and 0h workload (100 load pref) -> Final Score = 100.0 */
    int ok = (n == 3 &&
              strcmp(top3[0].volunteer_id, "VOL-201") == 0 &&
              fabs(top3[0].compatibility_score - 100.0) < 0.1 &&
              fabs(top3[0].final_score - 100.0) < 0.1 &&
              top3[0].final_score >= top3[1].final_score &&
              top3[1].final_score >= top3[2].final_score);

    snprintf(
        details, details_len,
        "Ranked %d candidates via Bubble Sort: #1 %s (Final %.1f, Compat %.1f%%), #2 %s (Final %.1f), #3 %s (Final %.1f).",
        n,
        n > 0 ? top3[0].volunteer_id : "None", n > 0 ? top3[0].final_score : 0.0, n > 0 ? top3[0].compatibility_score : 0.0,
        n > 1 ? top3[1].volunteer_id : "None", n > 1 ? top3[1].final_score : 0.0,
        n > 2 ? top3[2].volunteer_id : "None", n > 2 ? top3[2].final_score : 0.0
    );

    task_free_list(task);
    volunteer_free_list(vols);
    return ok;
}

/* TC03: No Matching Volunteer */
static int run_tc03(char* details, size_t details_len) {
    VolunteerNode* vols = NULL;
    volunteer_insert(&vols, volunteer_create(
        "VOL-301", "Meera Patel", "meera@campus.edu", "900010",
        "Hospitality", "Catering, Guest Relations", "1 event",
        "Available", "Morning", "Available", "", 0.0
    ));
    volunteer_insert(&vols, volunteer_create(
        "VOL-302", "Vikram Joshi", "vikram@campus.edu", "900011",
        "Crowd Management", "Crowd Control, Security", "2 events",
        "Available", "Morning", "Available", "", 2.0
    ));

    TaskNode* task = task_create(
        "TSK-301", "EVT-1", "Photography", "DSLR event coverage & editing",
        "DSLR Photography, Video Editing, Lighting", 2, 0, 0,
        "Medium", "Campus Grounds", 3.0, "10:00", "13:00", "Needs Volunteers"
    );

    CandidateMatch top3[3];
    int n = find_top_candidates_for_task(vols, NULL, task, top3, 3);
    int ok = (n == 0);

    snprintf(
        details, details_len,
        "Evaluated 2 registered volunteers against 'DSLR Photography, Video Editing, Lighting'; matched candidate count = %d (correctly rejected zero-skill matches).",
        n
    );

    task_free_list(task);
    volunteer_free_list(vols);
    return ok;
}

/* TC04: Unavailable Volunteer Exclusion */
static int run_tc04(char* details, size_t details_len) {
    VolunteerNode* vols = NULL;
    volunteer_insert(&vols, volunteer_create(
        "VOL-401", "Arjun Verma", "arjun@campus.edu", "900020",
        "Photography", "DSLR Photography, Lighting", "4 events",
        "Unavailable", "Morning", "Unavailable", "", 0.0
    ));
    volunteer_insert(&vols, volunteer_create(
        "VOL-402", "Neha Kulkarni", "neha@campus.edu", "900021",
        "Photography", "DSLR Photography, Lighting", "3 events",
        "Available", "Morning", "Working", "TSK-101", 4.0
    ));
    volunteer_insert(&vols, volunteer_create(
        "VOL-403", "Devika Sharma", "devika@campus.edu", "900022",
        "Photography", "DSLR Photography", "1 event",
        "Available", "Afternoon", "Available", "", 2.0
    ));

    TaskNode* task = task_create(
        "TSK-401", "EVT-1", "Photography", "Main stage coverage",
        "DSLR Photography, Lighting", 1, 0, 0,
        "High", "Auditorium", 3.0, "14:00", "17:00", "Needs Volunteers"
    );

    CandidateMatch top3[3];
    int n = find_top_candidates_for_task(vols, NULL, task, top3, 3);
    int ok = (n == 1 && strcmp(top3[0].volunteer_id, "VOL-403") == 0);

    snprintf(
        details, details_len,
        "Excluded VOL-401 (Unavailable) and VOL-402 (currently Working on TSK-101); selected eligible VOL-403 (%s, Final Score %.1f).",
        n > 0 ? top3[0].volunteer_name : "None", n > 0 ? top3[0].final_score : 0.0
    );

    task_free_list(task);
    volunteer_free_list(vols);
    return ok;
}

/* TC05: Multiple Task Allocation, FIFO Queue Processing & Workload Balancing */
static int run_tc05(char* details, size_t details_len) {
    VolunteerNode* vols = NULL;
    volunteer_insert(&vols, volunteer_create(
        "VOL-501", "Siddharth Roy", "sid@campus.edu", "900030",
        "Food Management", "Logistics, Catering, Coordination", "2 events",
        "Available", "Full Day", "Available", "", 0.0
    ));
    volunteer_insert(&vols, volunteer_create(
        "VOL-502", "Ananya Gupta", "ananya@campus.edu", "900031",
        "Registration Management", "Communication, Coordination, Excel", "2 events",
        "Available", "Full Day", "Available", "", 8.0
    ));

    TaskNode* tasks = NULL;
    task_insert(&tasks, task_create(
        "TSK-501", "EVT-1", "Food Management", "Lunch distribution",
        "Logistics, Catering", 1, 0, 0,
        "High", "Cafeteria", 4.0, "12:00", "16:00", "Needs Volunteers"
    ));
    task_insert(&tasks, task_create(
        "TSK-502", "EVT-1", "Registration Management", "Badge desk",
        "Communication, Coordination", 1, 0, 0,
        "High", "Lobby", 3.0, "08:00", "11:00", "Needs Volunteers"
    ));

    Queue* q = queue_create();
    TaskNode* t_curr = tasks;
    while (t_curr != NULL) {
        if (t_curr->assigned_volunteers < t_curr->required_volunteers) {
            queue_enqueue(q, t_curr->id, t_curr->required_volunteers - t_curr->assigned_volunteers, t_curr->priority);
        }
        t_curr = t_curr->next;
    }

    AllocationNode* allocs = NULL;
    int assigned_count = 0;
    char task_id[32];
    int deficit = 0;
    char prio[32];

    while (queue_dequeue(q, task_id, &deficit, prio)) {
        TaskNode* task = task_search(tasks, task_id);
        CandidateMatch best;
        if (task && greedy_select_best(vols, allocs, task, &best)) {
            if (!allocation_exists_active(allocs, best.volunteer_id, task->id)) {
                VolunteerNode* v = volunteer_search(vols, best.volunteer_id);
                double prev_w = v->current_workload;
                v->current_workload += task->duration_hours;
                snprintf(v->status, sizeof(v->status), "Assigned");
                snprintf(v->assigned_task_id, sizeof(v->assigned_task_id), "%s", task->id);
                task->assigned_volunteers++;

                char alloc_id[32];
                snprintf(alloc_id, sizeof(alloc_id), "ALC-%d", assigned_count + 1);
                allocation_insert(&allocs, allocation_create(
                    alloc_id, "EVT-1", v->id, task->id,
                    best.compatibility_score, best.final_score,
                    prev_w, v->current_workload, best.matched_skills, "Assigned"
                ));
                assigned_count++;
            }
        }
    }

    int dup_check = allocation_exists_active(allocs, "VOL-501", "TSK-501");
    VolunteerNode* v501 = volunteer_search(vols, "VOL-501");
    VolunteerNode* v502 = volunteer_search(vols, "VOL-502");

    int ok = (assigned_count == 2 && queue_is_empty(q) &&
              dup_check == 1 &&
              v501 && fabs(v501->current_workload - 4.0) < 0.01 &&
              v502 && fabs(v502->current_workload - 11.0) < 0.01);

    snprintf(
        details, details_len,
        "Processed 2 tasks via FIFO Queue & Greedy Selection; allocated VOL-501->TSK-501 (workload 0h->%.1fh) and VOL-502->TSK-502 (workload 8h->%.1fh); duplicate check verified.",
        v501 ? v501->current_workload : 0.0,
        v502 ? v502->current_workload : 0.0
    );

    queue_free(q);
    allocation_free_list(allocs);
    task_free_list(tasks);
    volunteer_free_list(vols);
    return ok;
}

int main(void) {
    char d1[512], d2[512], d3[512], d4[512], d5[512];
    int p1 = run_tc01(d1, sizeof(d1));
    int p2 = run_tc02(d2, sizeof(d2));
    int p3 = run_tc03(d3, sizeof(d3));
    int p4 = run_tc04(d4, sizeof(d4));
    int p5 = run_tc05(d5, sizeof(d5));

    int total_passed = p1 + p2 + p3 + p4 + p5;

    printf("{\n");
    printf("  \"suite\": \"CSA0302 C Data Structures & Algorithms Automated Test Suite\",\n");
    printf("  \"compiler\": \"gcc -Wall -Wextra -Werror -std=c11\",\n");
    printf("  \"totalTests\": 5,\n");
    printf("  \"passedCount\": %d,\n", total_passed);
    printf("  \"failedCount\": %d,\n", 5 - total_passed);
    printf("  \"results\": [\n");
    print_test_result("TC01", "Volunteer Registration & Linked List CRUD", "Volunteer Singly Linked List", d1, p1, 0);
    print_test_result("TC02", "Successful Skill Matching & Bubble Sort Ranking", "Linked List, Weighted Scoring, Bubble Sort", d2, p2, 0);
    print_test_result("TC03", "No Matching Volunteer Exclusion", "Skill Matching Algorithm", d3, p3, 0);
    print_test_result("TC04", "Unavailable & Active Volunteer Exclusion", "Linked List Filtering, Status Guard", d4, p4, 0);
    print_test_result("TC05", "Multiple Task Allocation & Workload Balancing", "FIFO Queue, Allocation List, Greedy Selection", d5, p5, 1);
    printf("  ]\n");
    printf("}\n");

    return (total_passed == 5) ? 0 : 1;
}
