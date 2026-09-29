# -*- coding: utf-8 -*-
import lib
try:
    tools = lib.C.tools.get(user_id=lib.USER, toolkits=['googleappscript'])
    print(type(tools), tools)
except Exception as e:
    print('ERROR:', str(e)[:500])
