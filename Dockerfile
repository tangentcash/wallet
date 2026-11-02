FROM node:22 AS build
WORKDIR /home/make
ENV PIP_BREAK_SYSTEM_PACKAGES=1
RUN apt-get update && apt-get install -y python3 python3-pip && pip install mkdocs-material
COPY ./ /home/make
RUN yarn && yarn make && mkdocs build

FROM alpine:latest AS deployment
WORKDIR /home
COPY --from=build /home/make/dist /home/wallet
RUN apk add --no-cache nginx nginx-mod-http-brotli
RUN ln -sf /dev/stdout /var/log/nginx/access.log && ln -sf /dev/stderr /var/log/nginx/error.log
EXPOSE 80
EXPOSE 443
CMD ["nginx", "-g", "daemon off;"]