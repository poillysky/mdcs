from apps.server.src.library.identify import identifyFromFileName

for name in [
    "C0930-GOL0149.strm",
    "GOL-0149.mp4",
    "GOL0149.mp4",
    "C0930-GOL-0149.strm",
]:
    print(name, "->", identifyFromFileName(name))
