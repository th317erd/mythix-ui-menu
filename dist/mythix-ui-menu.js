import { MythixUIComponent, Utils } from 'mythix-ui-core';

const IS_POPOVER = /^mythix-popover$/i;

const ITEM_ELEMENT_TYPE = 'li';
const MENU_ELEMENT_TYPE = 'menu';

const AUTO_OPEN_TIME_DEFAULT = 500;

export class MythixUIMenu extends MythixUIComponent {
  static tagName = 'mythix-menu';

  get autoOpenTime() {
    let value = this.attr('auto-open-time');
    if (value == null || value === '')
      return AUTO_OPEN_TIME_DEFAULT;

    return Math.round(parseFloat(value));
  }

  set autoOpenTime(_value) {
    let value = Math.round(parseFloat(_value));
    if (!isFinite(value))
      value = AUTO_OPEN_TIME_DEFAULT;

    this.attr('auto-open-time', value);
  }

  constructor() {
    super();

    let currentHoveredItem = null;

    Object.defineProperties(this, {
      '_currentHoveredItem': {
        enumerable:   false,
        configurable: true,
        get:          () => currentHoveredItem,
        set:          (newValue) => {
          let chi = currentHoveredItem;

          currentHoveredItem = newValue;

          this.onHoveredItemChange(newValue, chi);
        },
      },
    });
  }

  mounted() {
    super.mounted();

    document.addEventListener('click', this.onClick);
    document.addEventListener('keydown', this.onKeyDown);

    this.addEventListener('mouseover', this.onMouseOver);
    this.addEventListener('mouseout', this.onMouseOut);

    this.select(ITEM_ELEMENT_TYPE).forEach((element) => {
      if (!element.getAttribute('id'))
        element.setAttribute('id', Utils.getObjectID(element));
    });

    this.select(MENU_ELEMENT_TYPE).forEach((element) => {
      if (!element.getAttribute('id'))
        element.setAttribute('id', Utils.getObjectID(element));

      let popover = document.createElement('mythix-popover');
      popover.setAttribute('id', Utils.getObjectID(popover));

      let itemElement = element.closest(ITEM_ELEMENT_TYPE);
      if (itemElement) {
        popover.setAttribute('anchor', itemElement.getAttribute('id') || Utils.getObjectID(itemElement));

        if (this.isTopLevelItem(itemElement))
          popover.setAttribute('anchor-alignment', '0.0 1.0 0.0 0.0');
        else
          popover.setAttribute('anchor-alignment', '1.0 0.0 0.0 0.0');

        itemElement.classList.add('has-sub-menu');
      }

      element.parentNode.replaceChild(popover, element);
      popover.appendChild(element);
    });
  }

  unmounted() {
    this.removeEventListener('mouseout', this.onMouseOut);
    this.removeEventListener('mouseover', this.onMouseOver);

    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('click', this.onClick);
  }

  isMenuOpen() {
    return this.select('mythix-popover[open]')[0];
  }

  getClickItem(event) {
    return event.target.closest(ITEM_ELEMENT_TYPE);
  }

  isTopLevelItem(itemElement) {
    return (Array.from(this.childNodes).indexOf(itemElement) >= 0);
  }

  findChildMenu(itemElement) {
    if (!itemElement || !itemElement.children)
      return;

    return Array.from(itemElement.children).find((element) => {
      return IS_POPOVER.test(element.tagName);
    });
  }

  onHoveredItemChange(itemElement) {
    if (!itemElement) {
      this.clearDebounce('itemHoverPendingOpen');
      return;
    }

    let autoOpenTime = this.autoOpenTime;
    if (!autoOpenTime)
      return;

    let isTopLevel = this.isTopLevelItem(itemElement);
    this.debounce(() => {
      if (isTopLevel && !this.isMenuOpen())
        return;

      if (this.findChildMenu(itemElement))
        this.toggleOpenItem(itemElement, true);
      else
        this.closeAll(itemElement);
    }, (isTopLevel) ? 10 : autoOpenTime, 'itemHoverPendingOpen');
  }

  onMouseOver(event) {
    let itemElement = event.target.closest(ITEM_ELEMENT_TYPE);
    if (this._currentHoveredItem === itemElement)
      return;

    this._currentHoveredItem = itemElement || null;
  }

  onMouseOut(event) {
    let element = (event.relatedTarget) ? event.relatedTarget.closest('mythix-menu') : null;
    if (element !== this)
      this._currentHoveredItem = null;
  }

  onKeyDown(event) {
    if (event.code === 'Escape') {
      if (this.closeAll()) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
    }
  }

  closeAll(except) {
    let anyClosed = false;

    this.select('mythix-popover[open]').forEach((element) => {
      if (except && element.contains(except))
        return;

      anyClosed = true;
      element.hidePopover();
    });

    return anyClosed;
  }

  onClick(event) {
    if (!this.contains(event.target)) {
      this.closeAll();
      return;
    }

    let itemElement = this.getClickItem(event);
    if (!itemElement)
      return;

    event.stopPropagation();
    event.preventDefault();

    this.toggleOpenItem(itemElement);
  }

  toggleOpenItem(itemElement, force) {
    let popover = this.findChildMenu(itemElement);
    if (!popover)
      return;

    this.closeAll(popover);

    return popover.togglePopover(force);
  }

  createShadowDOM() {
  }
}

MythixUIMenu.register();
