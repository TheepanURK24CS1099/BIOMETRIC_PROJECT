#!/bin/bash
mkdir -p /home/ubuntu/backups
pg_dump -U postgres hostel_attendance > /home/ubuntu/backups/hostel_$(date +%F).sql