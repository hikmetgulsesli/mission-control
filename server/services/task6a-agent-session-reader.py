"""Private Task6A agent-session snapshot with descriptor-pinned traversal."""

import errno
import json
import os
import stat
import sys

DIRECTORY_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
FILE_FLAGS = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK
MAX_FILE = 256_000
MAX_TOTAL = 8_000_000


def open_absolute_directory(path):
    if not path.startswith("/") or "\x00" in path:
        raise ValueError("invalid source path")
    components = path.split("/")[1:]
    if not components or any(part in ("", ".", "..") for part in components):
        raise ValueError("invalid source path")
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


def read_bounded(fd):
    metadata = os.fstat(fd)
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > MAX_FILE:
        raise ValueError("invalid session file")
    chunks = []
    remaining = MAX_FILE + 1
    while remaining:
        chunk = os.read(fd, min(remaining, 64_000))
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    if remaining == 0:
        raise ValueError("session file too large")
    return b"".join(chunks).decode("utf-8")


def bounded_names(fd):
    names = []
    with os.scandir(fd) as entries:
        for entry in entries:
            names.append(entry.name)
            if len(names) > 100:
                raise ValueError("too many source entries")
    return names


def snapshot(agents_path):
    agents_fd = open_absolute_directory(agents_path)
    result = []
    total = 0
    try:
        agent_names = sorted(bounded_names(agents_fd))
        for agent_name in agent_names:
            agent_metadata = os.stat(agent_name, dir_fd=agents_fd, follow_symlinks=False)
            if stat.S_ISLNK(agent_metadata.st_mode):
                raise ValueError("symlink agent directory")
            if not stat.S_ISDIR(agent_metadata.st_mode):
                continue
            try:
                agent_fd = os.open(agent_name, DIRECTORY_FLAGS, dir_fd=agents_fd)
            except OSError as error:
                if error.errno in (errno.ENOTDIR, errno.ELOOP):
                    raise ValueError("changed agent directory") from error
                raise
            try:
                try:
                    sessions_fd = os.open("sessions", DIRECTORY_FLAGS, dir_fd=agent_fd)
                except FileNotFoundError:
                    continue
                try:
                    names = [name for name in bounded_names(sessions_fd)
                             if name.endswith(".jsonl")]
                    latest = None
                    for name in names:
                        file_fd = os.open(name, FILE_FLAGS, dir_fd=sessions_fd)
                        try:
                            metadata = os.fstat(file_fd)
                            if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > MAX_FILE:
                                raise ValueError("invalid session file")
                            key = (metadata.st_mtime_ns, name)
                            if latest is None or key[0] > latest[0][0] or (
                                key[0] == latest[0][0] and key[1] < latest[0][1]
                            ):
                                if latest is not None:
                                    os.close(latest[1])
                                latest = (key, file_fd)
                                file_fd = None
                        finally:
                            if file_fd is not None:
                                os.close(file_fd)
                    if latest is not None:
                        try:
                            raw = read_bounded(latest[1])
                        finally:
                            os.close(latest[1])
                        total += len(raw.encode("utf-8"))
                        if total > MAX_TOTAL:
                            raise ValueError("session snapshot too large")
                        result.append({"agentId": agent_name,
                                       "sessionId": latest[0][1][:-6], "raw": raw})
                finally:
                    os.close(sessions_fd)
            finally:
                os.close(agent_fd)
    finally:
        os.close(agents_fd)
    return result


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise ValueError("one source path required")
    sys.stdout.write(json.dumps(snapshot(sys.argv[1]), ensure_ascii=False,
                                separators=(",", ":")))
