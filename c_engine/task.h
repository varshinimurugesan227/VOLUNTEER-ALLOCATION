#ifndef TASK_H
#define TASK_H

#define TASK_ID_LEN 32
#define TASK_NAME_LEN 128
#define TASK_DESC_LEN 256
#define TASK_SKILLS_LEN 256

typedef struct TaskNode {
    char id[TASK_ID_LEN];
    char event_id[TASK_ID_LEN];
    char name[TASK_NAME_LEN];
    char description[TASK_DESC_LEN];
    char required_skills[TASK_SKILLS_LEN];
    int required_volunteers;
    int assigned_volunteers;
    int working_volunteers;
    char priority[32];
    char location[TASK_NAME_LEN];
    double duration_hours;
    char start_time[32];
    char end_time[32];
    char status[32];
    struct TaskNode* next;
} TaskNode;

TaskNode* task_create(
    const char* id,
    const char* event_id,
    const char* name,
    const char* description,
    const char* required_skills,
    int required_volunteers,
    int assigned_volunteers,
    int working_volunteers,
    const char* priority,
    const char* location,
    double duration_hours,
    const char* start_time,
    const char* end_time,
    const char* status
);

void task_insert(TaskNode** head, TaskNode* node);
TaskNode* task_search(TaskNode* head, const char* id);
int task_delete(TaskNode** head, const char* id);
int task_update_status(TaskNode* head, const char* id, const char* status);
int task_count(TaskNode* head);
void task_free_list(TaskNode* head);

#endif
