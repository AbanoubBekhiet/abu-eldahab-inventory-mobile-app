import re

with open('src/app/personal-info.tsx', 'r') as f:
    content = f.read()

# I will write the whole file to make it simpler and avoid parsing errors
