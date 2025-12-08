#!/bin/bash
source .env
npx prisma db push --url="$DATABASE_URL"
