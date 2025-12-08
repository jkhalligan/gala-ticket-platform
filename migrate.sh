#!/bin/bash
source .env
npx prisma migrate dev --url="$DATABASE_URL"
