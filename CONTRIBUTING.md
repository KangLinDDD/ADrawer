# Contributing to Image Annotation Drawer

感谢你对 Image Annotation Drawer 的兴趣！我们欢迎各种形式的贡献。

## 如何贡献

### 报告问题

如果你发现了 bug 或有功能建议，请通过 [GitHub Issues](https://github.com/KangLinDDD/ADrawer/issues) 提交。\n
提交问题时请包含：
- 问题的清晰描述
- 复现步骤
- 期望行为 vs 实际行为
- 浏览器环境和版本
- 如果有截图会更好

### 提交代码

1. **Fork 仓库**
   ```bash
   # 点击 GitHub 上的 Fork 按钮
   ```

2. **克隆你的 Fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/ADrawer.git
   cd ADrawer
   ```

3. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

4. **安装依赖并开发**
   ```bash
   npm install
   npm run dev
   ```

5. **确保代码质量**
   ```bash
   npm run lint
   npm test
   npm run build
   ```

6. **提交更改**
   ```bash
   git add .
   git commit -m "feat: add some feature"
   ```

7. **推送到你的 Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **创建 Pull Request**
   - 访问 https://github.com/KangLinDDD/ADrawer/pulls
   - 点击 "New Pull Request"
   - 选择你的分支

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `style:` 代码格式（不影响功能的更改）
- `refactor:` 代码重构
- `test:` 测试相关
- `chore:` 构建过程或辅助工具的变动

示例：
```bash
git commit -m "feat: add polygon vertex deletion"
git commit -m "fix: correct text annotation vertical alignment"
git commit -m "docs: update API reference for selection"
```

## 开发指南

### 项目结构

```
src/
├── index.ts           # 主入口
├── modules/
│   ├── types.ts       # 类型定义
│   ├── viewport.ts    # 视口管理
│   ├── annotations.ts # 标注管理
│   ├── text-annotation.ts # 文本标注
│   ├── renderer.ts    # 渲染器
│   ├── events.ts      # 事件处理
│   └── utils.ts       # 工具函数
__tests__/             # 测试文件
examples/              # 示例
```

### 代码风格

- 使用 TypeScript
- 2 空格缩进
- 单引号
- 分号必需
- 尾随逗号

### 测试

- 新功能需要添加测试
- 所有测试必须通过
- 测试覆盖率应保持在合理水平

运行测试：
```bash
npm test              # 运行所有测试
npm run test:watch    # 监视模式
npm run test:coverage # 生成覆盖率报告
```

## 发布流程

维护者使用以下流程发布新版本：

1. 更新 `CHANGELOG.md`
2. 更新版本号：`npm version patch|minor|major`
3. 推送到 GitHub：`git push && git push --tags`
4. 创建 Release，CI 会自动发布到 npm

## 行为准则

- 保持友好和尊重
- 欢迎新手，耐心解答问题
- 专注于技术讨论
- 接受不同的观点和经验

## 获取帮助

- 查看 [README](./README.md) 和 [文档](https://kanglinddd.github.io/ADrawer/)
- 在 [GitHub Discussions](https://github.com/KangLinDDD/ADrawer/discussions) 提问
- 加入我们的社区

再次感谢你的贡献！
