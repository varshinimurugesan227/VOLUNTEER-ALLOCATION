#ifndef ALLOCATION_H
#define ALLOCATION_H

#include "volunteer.h"
#include "task.h"

#define MAX_CANDIDATES 256

typedef struct AllocationNode {
    char id[32];
    char event_id[32];
    char volunteer_id[32];
    char task_id[32];
    double compatibility_score;
    double final_score;
    double previous_workload;
    double updated_workload;
    char matched_skills[256];
    char status[32];
    struct AllocationNode* next;
} AllocationNode;

typedef struct CandidateMatch {
    char volunteer_id[32];
    char volunteer_name[128];
    char email[128];
    char skills[256];
    char matched_skills[256];
    int matched_count;
    int required_count;
    int preferred_match;
    double current_workload;
    double compatibility_score;
    double load_preference;
    double final_score;
    char explanation[512];
} CandidateMatch;

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
);

void allocation_insert(AllocationNode** head, AllocationNode* node);
AllocationNode* allocation_search(
    AllocationNode* head,
    const char* volunteer_id,
    const char* task_id
);
int allocation_exists_active(
    AllocationNode* head,
    const char* volunteer_id,
    const char* task_id
);
void allocation_free_list(AllocationNode* head);

/* Core Algorithms */
int match_skills(
    const char* required_skills,
    const char* volunteer_skills,
    char* out_matched_skills,
    int* out_matched_count,
    int* out_required_count
);

int check_preferred_task(const char* preferred_tasks, const char* task_name, const char* task_id);

void calculate_weighted_score(
    int matched_count,
    int required_count,
    double current_workload,
    double* out_compatibility_score,
    double* out_load_preference,
    double* out_final_score
);

void bubble_sort_candidates(CandidateMatch candidates[], int count);

int find_top_candidates_for_task(
    VolunteerNode* volunteers,
    AllocationNode* allocations,
    const TaskNode* task,
    CandidateMatch out_candidates[],
    int max_results
);

int greedy_select_best(
    VolunteerNode* volunteers,
    AllocationNode* allocations,
    const TaskNode* task,
    CandidateMatch* out_best
);

#endif
