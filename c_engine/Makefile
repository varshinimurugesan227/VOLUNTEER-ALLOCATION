CC = gcc
CFLAGS = -Wall -Wextra -Werror -std=c11 -O2
LDFLAGS = -lm

CORE_SRCS = volunteer.c task.c queue.c allocation.c event.c
CORE_OBJS = $(CORE_SRCS:.c=.o)

all: volunteer_engine test_runner

volunteer_engine: $(CORE_OBJS) main.o
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)
	chmod 755 $@

test_runner: $(CORE_OBJS) test_cases.o
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)
	chmod 755 $@

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f *.o volunteer_engine test_runner

.PHONY: all clean
