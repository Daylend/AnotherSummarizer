.PHONY: all

all:
	zip -r addon.zip . -x "*.zip" -x ".git/*"
