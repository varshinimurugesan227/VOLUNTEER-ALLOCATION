#include "task.h"
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
) {
    TaskNode* node = (TaskNode*)malloc(sizeof(TaskNode));
    if (!node) {
        return NULL;
    }

    safe_copy(node->id, id, TASK_ID_LEN);
    safe_copy(node->event_id, event_id, TASK_ID_LEN);
    safe_copy(node->name, name, TASK_NAME_LEN);
    safe_copy(node->description, description, TASK_DESC_LEN);
    safe_copy(node->required_skills, required_skills, TASK_SKILLS_LEN);
    node->required_volunteers = required_volunteers;
    node->assigned_volunteers = assigned_volunteers;
    node->working_volunteers = working_volunteers;
    safe_copy(node->priority, priority, 32);
    safe_copy(node->location, location, TASK_NAME_LEN);
    node->duration_hours = duration_hours;
    safe_copy(node->start_time, start_time, 32);
    safe_copy(node->end_time, end_time, 32);
    safe_copy(node->status, status, 32);
    node->next = NULL;
    return node;
}

void task_insert(TaskNode** head, TaskNode* node) {
    if (!head || !node) {
        return;
    }
    if (*head == NULL) {
        *head = node;
        return;
    }
    TaskNode* curr = *head;
    while (curr->next != NULL) {
        curr = curr->next;
    }
    curr->next = node;
}

TaskNode* task_search(TaskNode* head, const char* id) {
    TaskNode* curr = head;
    while (curr != NULL) {
        if (strcmp(curr->id, id) == 0) {
            return curr;
        }
        curr = curr->next;
    }
    return NULL;
}

int task_delete(TaskNode** head, const char* id) {
    if (!head || !*head) {
        return 0;
    }
    TaskNode* curr = *head;
    TaskNode* prev = NULL;

    while (curr != NULL) {
        if (strcmp(curr->id, id) == 0) {
            if (prev == NULL) {
                *head = curr->next;
            } else {
                prev->next = curr->next;
            }
            free(curr);
            return 1;
        }
        prev = curr;
        curr = curr->next;
    }
    return 0;
}

int task_update_status(TaskNode* head, const char* id, const char* status) {
    TaskNode* target = task_search(head, id);
    if (!target) {
        return 0;
    }
    if (status && status[0] != '\0') {
        safe_copy(target->status, status, 32);
    }
    return 1;
}

int task_count(TaskNode* head) {
    int count = 0;
    TaskNode* curr = head;
    while (curr != NULL) {
        count++;
        curr = curr->next;
    }
    return count;
}

void task_free_list(TaskNode* head) {
    TaskNode* curr = head;
    while (curr != NULL) {
        TaskNode* next = curr->next;
        free(curr);
        curr = next;
    }
}
