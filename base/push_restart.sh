#!/bin/sh
rsync \
  --compress \
  --recursive \
  --include-from="./rsync-include.txt" \
  --exclude="*" \
  --delete \
  --times \
  -e "ssh -i \"./notkeys/key\"" \
  ./ ubuntu@193.122.154.50:/var/www/
ssh -i "./notkeys/key" ubuntu@193.122.154.50 "/home/ubuntu/restart-clockbot"
echo "Done"
