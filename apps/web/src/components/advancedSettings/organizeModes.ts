export const ORGANIZE_MODES = [
  { value: "hardlink", label: "硬链接", hint: "同盘零拷贝，不支持跨盘" },
  { value: "softlink", label: "软链接", hint: "仅生成链接，播放器需能寻址源文件" },
  { value: "inplace", label: "原地整理", hint: "源目录内出结果，忽略输出目录" },
  { value: "copy", label: "复制", hint: "保留源文件，占用双倍空间" },
  { value: "move", label: "移动", hint: "删除源文件，请谨慎使用" },
] as const;
