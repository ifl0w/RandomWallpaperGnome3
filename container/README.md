Development Containers
=====
The files in this directory are used to easily test the extension for other GNOME versions without the need for multiple virtual machines or systems. We use [x11docker](https://github.com/mviereck/x11docker) for this which is a bash script which does some preprocessing before finally starting a docker container. Each Docker image is only around 700-900 MB in size depending on the version.

## Getting x11docker
First get x11docker which is included as a submodule in this repository:
```shell
git submodule init
git submodule update --depth=1
```

## Building desired Docker images
Currently we use Ubuntu in the images to determine the GNOME version. This version must be provided as a build argument when building the Docker image:
```shell
docker build -t gnome38 --build-arg VERSION=21.04 .
```

The following Ubuntu versions are known to be working:

Ubuntu | GNOME
------ | -----
20.04 (LTS) | 3.36.9
21.04 | 3.38.4
21.10 | 40.5

The images are very minimal to keep them small. Only the necessary GNOME components are included.

## Running x11docker
> Some version of Docker have trouble running Ubuntu 21.10. In this case you might have to add `--security-opt seccomp=unconfined` to the `runx11docker.sh` script after the `--mount` parameter. As this reduces the security of the container, this is not added by default.

The script `runx11docker.sh` is provided to start x11docker with the correct parameters. It automatically mounts the extension directory from this repository in the GNOME container. You need to supply the name of your recently build image as argument:
```shell
./runx11docker.sh gnome38
```

**For unknown reasons you have to move the X window around until the container is fully loaded for now.**

The application ARandR is included which can use the change the resolution. You can enable the extension and access the settings window via the Extensions application.

## Testing changes
You can keep the container running while making changes. Once you've made some changes to the code, be sure to run `build.sh` from the parent directory so `gschemas.compiled` is recreated.

Inside the container you have to restart GNOME. Press CTRL + SHIFT to lock your mouse and keyboard in the X windows so you can use key modifiers. Then restart GNOME by pressing ALT + F2 and running the command `r`. You can use CTRL + SHIFT to release your keyboard and mouse again.

For some reason filtering as usual in `debug.sh` doesn't work inside the container. You can just run `journalctl -f` inside the container and look for relevant output.
