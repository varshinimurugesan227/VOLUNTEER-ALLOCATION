#ifndef EVENT_H
#define EVENT_H

#include "volunteer.h"
#include "task.h"
#include "allocation.h"
#include "queue.h"

typedef struct EventContext {
    char event_id[32];
    char event_name[128];
    VolunteerNode* volunteers;
    TaskNode* tasks;
    AllocationNode* allocations;
} EventContext;

void event_context_init(EventContext* ctx, const char* event_id, const char* event_name);
void event_context_free(EventContext* ctx);
int event_load_from_stream(EventContext* ctx, FILE* fp);

void json_print_escaped(const char* str);

void event_output_live_stats_json(const EventContext* ctx);
void event_output_recommend_json(const EventContext* ctx, const char* task_id);
void event_output_allocate_check_json(
    const EventContext* ctx,
    const char* volunteer_id,
    const char* task_id
);
void event_output_optimize_json(const EventContext* ctx);
void event_output_analytics_json(const EventContext* ctx);

#endif
