FROM node:22 AS build
WORKDIR /home/make
ENV PIP_BREAK_SYSTEM_PACKAGES=1
RUN apt-get update && apt-get install -y python3 python3-pip && pip install mkdocs-material
COPY ./ /home/make
RUN yarn && yarn make && mkdocs build

FROM nginx AS deployment
WORKDIR /home
COPY --from=build /home/make/dist /home/wallet
EXPOSE 80
EXPOSE 443