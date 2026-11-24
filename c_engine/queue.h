#ifndef QUEUE_H
#define QUEUE_H

typedef struct QueueNode {
    char task_id[32];
    int deficit;
    char priority[32];
    struct QueueNode* next;
} QueueNode;

typedef struct Queue {
    QueueNode* front;
    QueueNode* rear;
    int size;
} Queue;

Queue* queue_create(void);
int queue_is_empty(const Queue* q);
void queue_enqueue(Queue* q, const char* task_id, int deficit, const char* priority);
int queue_dequeue(Queue* q, char* out_task_id, int* out_deficit, char* out_priority);
QueueNode* queue_front(const Queue* q);
QueueNode* queue_rear(const Queue* q);
void queue_free(Queue* q);

#endif
