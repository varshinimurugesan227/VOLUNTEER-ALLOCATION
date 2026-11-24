#include <stdio.h>
#include <string.h>
#include "event.h"

int main(int argc, char* argv[]) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <live_stats|recommend|allocate_check|optimize|analytics> [args...]\n", argv[0]);
        return 1;
    }

    EventContext ctx;
    event_context_init(&ctx, "", "");
    event_load_from_stream(&ctx, stdin);

    const char* cmd = argv[1];

    if (strcmp(cmd, "live_stats") == 0) {
        event_output_live_stats_json(&ctx);
    } else if (strcmp(cmd, "recommend") == 0) {
        if (argc < 3) {
            printf("{\"error\": \"Missing taskId argument\", \"candidates\": []}\n");
            event_context_free(&ctx);
            return 1;
        }
        event_output_recommend_json(&ctx, argv[2]);
    } else if (strcmp(cmd, "allocate_check") == 0) {
        if (argc < 4) {
            printf("{\"allowed\": false, \"reason\": \"Missing volunteerId or taskId\"}\n");
            event_context_free(&ctx);
            return 1;
        }
        event_output_allocate_check_json(&ctx, argv[2], argv[3]);
    } else if (strcmp(cmd, "optimize") == 0) {
        event_output_optimize_json(&ctx);
    } else if (strcmp(cmd, "analytics") == 0) {
        event_output_analytics_json(&ctx);
    } else {
        printf("{\"error\": \"Unknown command\"}\n");
        event_context_free(&ctx);
        return 1;
    }

    event_context_free(&ctx);
    return 0;
}
