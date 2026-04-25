PREFIX ?= /usr/local
SWIFT_TARGET ?= arm64-apple-macos14.0

all: uitocc uitocc-ax-text uitocc-send uitocc-embed

uitocc: cli.ts mcp-server.ts daemon.tsx
	bun build --compile cli.ts --outfile uitocc

uitocc-ax-text: ax_text.swift
	swiftc ax_text.swift -o uitocc-ax-text -O -target $(SWIFT_TARGET)

uitocc-send: send.swift
	swiftc send.swift -o uitocc-send -O -target $(SWIFT_TARGET)

uitocc-embed: embed.swift
	swiftc embed.swift -o uitocc-embed -O -target $(SWIFT_TARGET)

install: all
	install -d $(PREFIX)/bin
	install -m 755 uitocc $(PREFIX)/bin/uitocc
	install -m 755 uitocc-ax-text $(PREFIX)/bin/uitocc-ax-text
	install -m 755 uitocc-send $(PREFIX)/bin/uitocc-send
	install -m 755 uitocc-embed $(PREFIX)/bin/uitocc-embed

uninstall:
	rm -f $(PREFIX)/bin/uitocc
	rm -f $(PREFIX)/bin/uitocc-ax-text
	rm -f $(PREFIX)/bin/uitocc-send
	rm -f $(PREFIX)/bin/uitocc-embed

clean:
	rm -f uitocc uitocc-ax-text uitocc-send uitocc-embed

.PHONY: all install uninstall clean
