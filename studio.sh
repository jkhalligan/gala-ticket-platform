#!/bin/bash
# Read DATABASE_URL from .env
source .env
npx prisma studio --url="$DATABASE_URL"
