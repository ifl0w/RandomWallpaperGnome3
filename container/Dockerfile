# MIT License
#
# Copyright (c) 2019 mviereck
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
#
# Based on x11docker/gnome
# https://github.com/mviereck/x11docker

ARG VERSION
FROM ubuntu:${VERSION}
ENV LANG en_US.UTF-8
ENV SHELL=/bin/bash

# cleanup script for use after apt-get
RUN echo '#! /bin/sh\n\
env DEBIAN_FRONTEND=noninteractive apt-get autoremove -y\n\
apt-get clean\n\
find /var/lib/apt/lists -type f -delete\n\
find /var/cache -type f -delete\n\
find /var/log -type f -delete\n\
exit 0\n\
' > /cleanup && chmod +x /cleanup

# basics
RUN apt-get update && \
    env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      locales && \
      echo "$LANG UTF-8" >> /etc/locale.gen && \
      locale-gen && \
    env DEBIAN_FRONTEND=noninteractive apt-get install -y \
      dbus \
      dbus-x11 \
      systemd && \
    /cleanup

# Gnome 3
RUN apt-get update && \
    env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      gnome-session && \
    /cleanup

# Gnome 3 apps
RUN apt-get update && \
    env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      arandr `#Lightweight utility to set resolution` \
      gnome-icon-theme \
      gnome-terminal \
      nautilus && \
    /cleanup

# Gnome Shell extensions
RUN apt-get update && \
    env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      gnome-shell-extension-prefs && \
    /cleanup

# Workaround to get gnome-session running.
# gnome-session fails if started directly. Running gnome-shell only works, but lacks configuration support.
RUN apt-get update && \
    env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      guake && \
    rm /usr/share/applications/guake.desktop /usr/share/applications/guake-prefs.desktop && \
    echo "#! /bin/bash\n\
guake -e gnome-session\n\
while pgrep gnome-shell; do sleep 1 ; done\n\
" >/usr/local/bin/startgnome && \
    chmod +x /usr/local/bin/startgnome && \
    /cleanup

# Make sure we already add a user so bind mount won't cause problems later
RUN adduser --disabled-password --gecos "" dev
USER dev

# Also prevent the parent directories of the mount to be created and thus owned by root
RUN mkdir --parents /home/dev/.local/share/gnome-shell/extensions/randomwallpaper@iflow.space

CMD /usr/local/bin/startgnome
