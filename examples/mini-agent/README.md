# mini-agent

Part E 的示例：922 行复刻 Pi 的循环、消息与工具形状。

`E01` 只需要前四个文件（`types.ts` / `provider/mock.ts` / `loop.ts` / `demo.ts`）：

```bash
node src/demo.ts
```

`E02` 加一道投影闸门（`messages.ts` + `demo-memory.ts`）：

```bash
node src/demo-memory.ts
```

后面几章才会用到完整入口：

```bash
node src/cli.ts --mock "读 README"
node src/cli.ts --fixture "你好"
node --test "test/*.test.ts"
```

`--openai` 需要 `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL` 三个环境变量。
