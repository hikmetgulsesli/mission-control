"""Private Task6A transcript snapshot with descriptor-pinned traversal."""

import errno
import json
import os
import stat
import sys

DIRECTORY_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
FILE_FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
MAX_WORKFLOWS = 100
MAX_WORKFLOW_ENTRIES = 100
MAX_LOG_FILES = 500
MAX_FILE = 256_000
MAX_TOTAL = 8_000_000


def open_absolute_directory(path):
    if not path.startswith("/") or "\x00" in path:
        raise ValueError("invalid transcript path")
    components = path.split("/")[1:]
    if not components or any(part in ("", ".", "..") for part in components):
        raise ValueError("invalid transcript path")
    fd = os.open("/", DIRECTORY_FLAGS)
    try:
        for component in components:
            next_fd = os.open(component, DIRECTORY_FLAGS, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        return fd
    except BaseException:
        os.close(fd)
        raise


def bounded_names(fd, limit):
    names = []
    with os.scandir(fd) as entries:
        for entry in entries:
            names.append(entry.name)
            if len(names) > limit:
                raise ValueError("too many transcript entries")
    return sorted(names)


def read_bounded(fd):
    metadata = os.fstat(fd)
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > MAX_FILE:
        raise ValueError("invalid transcript file")
    chunks = []
    remaining = MAX_FILE + 1
    while remaining:
        chunk = os.read(fd, min(remaining, 64_000))
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    if remaining == 0:
        raise ValueError("transcript file too large")
    return b"".join(chunks).decode("utf-8")


def snapshot(transcripts_path):
    root_fd = open_absolute_directory(transcripts_path)
    result = []
    total = 0
    log_files = 0
    try:
        for workflow_name in bounded_names(root_fd, MAX_WORKFLOWS):
            metadata = os.stat(workflow_name, dir_fd=root_fd, follow_symlinks=False)
            if stat.S_ISLNK(metadata.st_mode):
                raise ValueError("symlink transcript workflow")
            if not stat.S_ISDIR(metadata.st_mode):
                continue
            try:
                workflow_fd = os.open(workflow_name, DIRECTORY_FLAGS, dir_fd=root_fd)
            except OSError as error:
                if error.errno in (errno.ENOTDIR, errno.ELOOP):
                    raise ValueError("changed transcript workflow") from error
                raise
            try:
                for name in bounded_names(workflow_fd, MAX_WORKFLOW_ENTRIES):
                    metadata = os.stat(name, dir_fd=workflow_fd, follow_symlinks=False)
                    if stat.S_ISLNK(metadata.st_mode):
                        raise ValueError("symlink transcript file")
                    if not name.endswith(".log"):
                        continue
                    log_files += 1
                    if log_files > MAX_LOG_FILES:
                        raise ValueError("too many transcript files")
                    file_fd = os.open(name, FILE_FLAGS, dir_fd=workflow_fd)
                    try:
                        raw = read_bounded(file_fd)
                    finally:
                        os.close(file_fd)
                    total += len(raw.encode("utf-8"))
                    if total > MAX_TOTAL:
                        raise ValueError("transcript snapshot too large")
                    result.append({"workflowId": workflow_name,
                                   "sessionId": name[:-4], "raw": raw})
            finally:
                os.close(workflow_fd)
    finally:
        os.close(root_fd)
    return result


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise ValueError("one transcript root required")
    sys.stdout.write(json.dumps(snapshot(sys.argv[1]), ensure_ascii=False,
                                separators=(",", ":")))
