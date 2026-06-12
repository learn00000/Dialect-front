import re
path = r"d:\AtoPos-Project\dialect\Dialect-front\js\main.js"
text = open(path, encoding="utf-8-sig").read()
lines = text.splitlines()
stack = []
for i, line in enumerate(lines, 1):
    # strip strings roughly
    stripped = re.sub(r"(['\"]).*?\1", "", line)
    stripped = re.sub(r"//.*", "", stripped)
    for j, c in enumerate(stripped):
        if c in "({[":
            stack.append((c, i))
        elif c in ")}]":
            if stack:
                stack.pop()
            else:
                print("extra close", c, "at line", i)
print("unclosed count:", len(stack))
for item in stack[-10:]:
    print(" ", item)
