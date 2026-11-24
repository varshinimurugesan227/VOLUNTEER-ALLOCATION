#include "volunteer.h"
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
) {
    VolunteerNode* node = (VolunteerNode*)malloc(sizeof(VolunteerNode));
    if (!node) {
        return NULL;
    }

    safe_copy(node->id, id, MAX_ID_LEN);
    safe_copy(node->name, name, MAX_NAME_LEN);
    safe_copy(node->email, email, MAX_NAME_LEN);
    safe_copy(node->contact, contact, 32);
    safe_copy(node->preferred_tasks, preferred_tasks, MAX_SKILLS_LEN);
    safe_copy(node->skills, skills, MAX_SKILLS_LEN);
    safe_copy(node->experience, experience, MAX_NAME_LEN);
    safe_copy(node->availability, availability, 64);
    safe_copy(node->preferred_slot, preferred_slot, 64);
    safe_copy(node->status, status, MAX_STATUS_LEN);
    safe_copy(node->assigned_task_id, assigned_task_id, MAX_ID_LEN);
    node->current_workload = current_workload;
    node->next = NULL;
    return node;
}

void volunteer_insert(VolunteerNode** head, VolunteerNode* node) {
    if (!head || !node) {
        return;
    }
    if (*head == NULL) {
        *head = node;
        return;
    }
    VolunteerNode* curr = *head;
    while (curr->next != NULL) {
        curr = curr->next;
    }
    curr->next = node;
}

VolunteerNode* volunteer_search(VolunteerNode* head, const char* id) {
    VolunteerNode* curr = head;
    while (curr != NULL) {
        if (strcmp(curr->id, id) == 0) {
            return curr;
        }
        curr = curr->next;
    }
    return NULL;
}

int volunteer_delete(VolunteerNode** head, const char* id) {
    if (!head || !*head) {
        return 0;
    }
    VolunteerNode* curr = *head;
    VolunteerNode* prev = NULL;

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

int volunteer_update_availability(
    VolunteerNode* head,
    const char* id,
    const char* availability,
    const char* status
) {
    VolunteerNode* target = volunteer_search(head, id);
    if (!target) {
        return 0;
    }
    if (availability && availability[0] != '\0') {
        safe_copy(target->availability, availability, 64);
    }
    if (status && status[0] != '\0') {
        safe_copy(target->status, status, MAX_STATUS_LEN);
    }
    return 1;
}

int volunteer_count(VolunteerNode* head) {
    int count = 0;
    VolunteerNode* curr = head;
    while (curr != NULL) {
        count++;
        curr = curr->next;
    }
    return count;
}

void volunteer_free_list(VolunteerNode* head) {
    VolunteerNode* curr = head;
    while (curr != NULL) {
        VolunteerNode* next = curr->next;
        free(curr);
        curr = next;
    }
}
