#include "queue.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

Queue* queue_create(void) {
    Queue* q = (Queue*)malloc(sizeof(Queue));
    if (!q) {
        return NULL;
    }
    q->front = NULL;
    q->rear = NULL;
    q->size = 0;
    return q;
}

int queue_is_empty(const Queue* q) {
    return (!q || q->front == NULL);
}

void queue_enqueue(Queue* q, const char* task_id, int deficit, const char* priority) {
    if (!q || !task_id) {
        return;
    }
    QueueNode* node = (QueueNode*)malloc(sizeof(QueueNode));
    if (!node) {
        return;
    }
    snprintf(node->task_id, sizeof(node->task_id), "%s", task_id);
    node->deficit = deficit;
    snprintf(node->priority, sizeof(node->priority), "%s", priority ? priority : "Medium");
    node->next = NULL;

    if (queue_is_empty(q)) {
        q->front = node;
        q->rear = node;
    } else {
        q->rear->next = node;
        q->rear = node;
    }
    q->size++;
}

int queue_dequeue(Queue* q, char* out_task_id, int* out_deficit, char* out_priority) {
    if (queue_is_empty(q)) {
        return 0;
    }
    QueueNode* temp = q->front;
    if (out_task_id) {
        snprintf(out_task_id, 32, "%s", temp->task_id);
    }
    if (out_deficit) {
        *out_deficit = temp->deficit;
    }
    if (out_priority) {
        snprintf(out_priority, 32, "%s", temp->priority);
    }

    q->front = q->front->next;
    if (q->front == NULL) {
        q->rear = NULL;
    }
    free(temp);
    q->size--;
    return 1;
}

QueueNode* queue_front(const Queue* q) {
    return q ? q->front : NULL;
}

QueueNode* queue_rear(const Queue* q) {
    return q ? q->rear : NULL;
}

void queue_free(Queue* q) {
    if (!q) {
        return;
    }
    while (!queue_is_empty(q)) {
        queue_dequeue(q, NULL, NULL, NULL);
    }
    free(q);
}
