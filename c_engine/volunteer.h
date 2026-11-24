#ifndef VOLUNTEER_H
#define VOLUNTEER_H

#define MAX_ID_LEN 32
#define MAX_NAME_LEN 128
#define MAX_SKILLS_LEN 256
#define MAX_STATUS_LEN 32

typedef struct VolunteerNode {
    char id[MAX_ID_LEN];
    char name[MAX_NAME_LEN];
    char email[MAX_NAME_LEN];
    char contact[32];
    char preferred_tasks[MAX_SKILLS_LEN];
    char skills[MAX_SKILLS_LEN];
    char experience[MAX_NAME_LEN];
    char availability[64];
    char preferred_slot[64];
    char status[MAX_STATUS_LEN];
    char assigned_task_id[MAX_ID_LEN];
    double current_workload;
    struct VolunteerNode* next;
} VolunteerNode;

VolunteerNode* volunteer_create(
    const char* id,
    const char* name,
    const char* email,
    const char* contact,
    const char* preferred_tasks,
    const char* skills,
    const char* experience,
    const char* availability,
    const char* preferred_slot,
    const char* status,
    const char* assigned_task_id,
    double current_workload
);

void volunteer_insert(VolunteerNode** head, VolunteerNode* node);
VolunteerNode* volunteer_search(VolunteerNode* head, const char* id);
int volunteer_delete(VolunteerNode** head, const char* id);
int volunteer_update_availability(
    VolunteerNode* head,
    const char* id,
    const char* availability,
    const char* status
);
int volunteer_count(VolunteerNode* head);
void volunteer_free_list(VolunteerNode* head);

#endif
