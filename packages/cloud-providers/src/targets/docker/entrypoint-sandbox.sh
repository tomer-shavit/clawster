#!/bin/sh
# Fix Docker socket permissions so the node user can access it.
# The socket is mounted from the host and may have any GID.
if [ -S /var/run/docker.sock ]; then
  chmod 666 /var/run/docker.sock
fi

# Drop to the node user and exec the original command
exec setpriv --reuid=node --regid=node --init-groups "$@"
