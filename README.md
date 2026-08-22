# Event-Driven Microservices Architecture with RabbitMQ & Docker

An asynchronous, event-driven e-commerce microservices platform built using **Node.js**, **Express**, **RabbitMQ**, and **Docker Compose**.

## System Architecture

```text
[ External REST Client ]
           │ (HTTP POST /orders)
           ▼
┌──────────────────────┐      order_created       ┌──────────────────────┐
│    Order Service     │ ───────────────────────► │       RabbitMQ       │
│     (Port 3001)      │          Event           │   (Message Broker)   │
└──────────────────────┘                          └──────────┬───────────┘
                                                             │
                                 ┌───────────────────────────┴───────────────────────────┐
                                 │                                                       │
                           order_created                                           payment_processed
                                 │                                                       │
                                 ▼                                                       ▼
                      ┌──────────────────────┐                                ┌──────────────────────┐
                      │   Payment Service    │ ─────────────────────────────► │ Notification Service │
                      └──────────────────────┘       payment_processed        └──────────────────────┘
                                                           Event