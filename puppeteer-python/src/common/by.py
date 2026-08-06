"""Minimal locator abstraction, playing the role of Selenium's ``org.openqa.selenium.By``
for Puppeteer, which natively only understands CSS selectors and XPath expressions.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class By:
    kind: str  # "css" | "xpath"
    value: str

    @staticmethod
    def css(selector: str) -> "By":
        return By("css", selector)

    @staticmethod
    def xpath(expression: str) -> "By":
        return By("xpath", expression)

    @staticmethod
    def id(element_id: str) -> "By":
        return By("css", f"#{element_id}")

    @staticmethod
    def tag(tag_name: str) -> "By":
        return By("css", tag_name)

    def __str__(self) -> str:
        return f"{self.kind}={self.value}"
