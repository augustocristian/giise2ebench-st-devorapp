package epigijon.devorapp.e2e.functional.utils;

import epigijon.devorapp.e2e.functional.common.ElementNotFoundException;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Click {

    private static final Logger log = LoggerFactory.getLogger(Click.class);

    public static WebDriver element(WebDriver driver, Waiter waiter, WebElement ele) throws ElementNotFoundException {
        String tagName = ele.getTagName();
        String text = ele.getText();
        try {
            waiter.waitUntil(ExpectedConditions.elementToBeClickable(ele), "Element not clickable");
            ele.click();
            log.debug("Click.element: ele:{}:{} ==>OK", tagName, text);
            return driver;
        } catch (Exception e) {
            log.error("Click.element: ele:{}:{} ==>KO {}", tagName, text, e.getLocalizedMessage());
        }
        try {
            byJS(driver, ele);
            log.debug("Click.element by JS: ele:{}:{} ==>OK", tagName, text);
            return driver;
        } catch (Exception e) {
            log.error("Click.element by JS: ele:{}:{} ==>KO {}", tagName, text, e.getLocalizedMessage());
        }
        throw new ElementNotFoundException("Click.element ERROR for " + tagName + ":" + text);
    }

    public static void byJS(WebDriver driver, WebElement we) {
        JavascriptExecutor js = (JavascriptExecutor) driver;
        js.executeScript("var evt = document.createEvent('MouseEvents');"
                + "evt.initMouseEvent('click',true,true,window,0,0,0,0,0,false,false,false,false,0,null);"
                + "arguments[0].dispatchEvent(evt);", we);
    }
}
