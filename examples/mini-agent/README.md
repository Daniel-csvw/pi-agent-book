# mini-agent

Part E 的示例：1,252 行复刻 Pi 的循环、消息、工具与会话形状，另加 249 行测试。

每章一个入口，按顺序跑：

```bash
node src/demo.ts          # E01 骨架：一轮读文件
node src/demo-memory.ts   # E02 投影：note 上屏，user 出门
node src/demo-model.ts    # E03 回放：fixture → chunk
node src/demo-tools.ts    # E04 工具：并发、写锁、三行 outcome
node src/demo-compact.ts  # E05 压缩：四个数字
node src/demo-session.ts  # E06 会话：两轮 + 一次重载
node src/demo-hooks.ts    # E07 钩子：拦一个、改一个、记一笔
```

E08 之后才是完整入口：

```bash
node src/cli.ts --mock "读 README"
node src/cli.ts --fixture "你好"
node --test "test/*.test.ts"
```

`--openai` 需要 `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL` 三个环境变量。
E01 只依赖前四个文件（`types.ts` / `provider/mock.ts` / `loop.ts` / `demo.ts`）。
