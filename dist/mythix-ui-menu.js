import {
  MythixUIComponent,
  Utils,
  Components,
} from 'mythix-ui-core';

const IS_ITEM           = /^li$/i;
const IS_POPOVER        = /^mythix-popover$/i;
const SHOULD_IGNORE_KEY = /^(Alt|AltGraph|CapsLock|Control|Fn|FnLock|Hyper|Meta|NumLock|ScrollLock|Shift|Super|Symbol|SymbolLock|OS)$/;

const ITEM_ELEMENT_TYPE = 'li';
const MENU_ELEMENT_TYPE = 'menu';

const AUTO_OPEN_TIME_DEFAULT = 500;

const WRAP_AROUND = true;

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

  createShadowDOM() {
  }

  mounted() {
    super.mounted();

    let id                  = this.attr('id');
    let currentHoveredItem  = null;
    let keybindings         = (id) ? (Utils.storage.get('localStorage', 'mythix-ui-menu', id, 'keybindings') || {}) : {};

    console.log('Key bindings!', keybindings);

    Object.defineProperties(this, {
      '_currentHoveredItem': {
        enumerable:   false,
        configurable: true,
        get:          () => currentHoveredItem,
        set:          (newValue) => {
          let chi = currentHoveredItem;

          currentHoveredItem = newValue;
          if (currentHoveredItem)
            currentHoveredItem.focus();

          this.onHoveredItemChange(newValue, chi);
        },
      },
      '_keybindings': {
        enumerable:   false,
        configurable: true,
        get:          () => keybindings,
        set:          (newValue) => {
          keybindings = newValue;
        },
      },
    });

    document.addEventListener('click', this.onClick);
    document.addEventListener('keydown', this.onKeyDown, { capture: true });

    this.addEventListener('mouseover', this.onMouseOver);
    this.addEventListener('mouseout', this.onMouseOut);
    this.addEventListener('focusin', this.onFocusIn);
    this.addEventListener('focusout', this.onFocusOut);

    let tabIndexCounter = Components.getLargestDocumentTabIndex() + 1;

    this.select(ITEM_ELEMENT_TYPE).forEach(($item) => {
      if (!$item.getAttribute('id'))
        $item.setAttribute('id', Utils.getObjectID($item));

      let tabIndex = $item.getAttribute('tabindex');
      if (tabIndex == null || tabIndex === '')
        $item.setAttribute('tabindex', tabIndexCounter++);
    });

    this.select(MENU_ELEMENT_TYPE).forEach(($menu) => {
      if (!$menu.getAttribute('id'))
        $menu.setAttribute('id', Utils.getObjectID($menu));

      let $popover = document.createElement('mythix-popover');
      $popover.setAttribute('id', Utils.getObjectID($popover));

      let $item = $menu.closest(ITEM_ELEMENT_TYPE);
      if ($item) {
        $popover.setAttribute('anchor', $item.getAttribute('id') || Utils.getObjectID($item));

        if (this.isTopLevelItem($item))
          $popover.setAttribute('anchor-alignment', '0.0 1.0 0.0 0.0');
        else
          $popover.setAttribute('anchor-alignment', '1.0 0.0 0.0 0.0');

        $item.classList.add('has-sub-menu');
      }

      $menu.parentNode.replaceChild($popover, $menu);
      $popover.appendChild($menu);
    });
  }

  unmounted() {
    this.removeEventListener('mouseout', this.onMouseOut);
    this.removeEventListener('mouseover', this.onMouseOver);

    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('click', this.onClick);
  }

  isAnyMenuOpen() {
    return this.select('mythix-popover[open]')[0];
  }

  isExpandableItem($item) {
    return !!this.findChildMenu($item);
  }

  isItemExpanded($item) {
    let childMenu = this.findChildMenu($item);
    if (!childMenu)
      return false;

    return childMenu.open;
  }

  getClickItem(event) {
    return event.target.closest(ITEM_ELEMENT_TYPE);
  }

  isTopLevelItem($item) {
    return (Array.from(this.childNodes).indexOf($item) >= 0);
  }

  findChildMenu($item) {
    if (!$item || !$item.children)
      return;

    return $item.querySelector(':scope > mythix-popover');
  }

  dispatchSelectedEvent($item) {
    let event = new Event('selected');

    event.relatedTarget = $item;
    event.command       = this.getItemPath($item);

    this.dispatchEvent(event);
  }

  updateHasFocusClasses() {
    // Update class list for items
    this.select(`${ITEM_ELEMENT_TYPE}.has-focus`)
        .forEach(($element) => $element.classList.remove('has-focus'));

    // Update class based on open popovers
    this.select('mythix-popover[open]')
        .forEach(($popover) => {
          let $item = $popover.closest(ITEM_ELEMENT_TYPE);
          if (!$item)
            return;

          $item.classList.add('has-focus');
        });
  }

  closeAll(...except) {
    let anyClosed = false;

    const isException = (element) => {
      return except.some((exceptElem) => element && element.contains(exceptElem));
    };

    this.select('mythix-popover[open]').forEach((element) => {
      if (isException(element))
        return;

      anyClosed = true;
      element.hidePopover();
    });

    this.updateHasFocusClasses();

    return anyClosed;
  }

  getItemPath(_$item) {
    let $item = _$item;
    let path        = [];

    while ($item) {
      let value = $item.getAttribute('value');
      if (value)
        path.push(value);

      let parentNode = Utils.getParentNode($item);
      $item = (parentNode) ? parentNode.closest(ITEM_ELEMENT_TYPE) : null;
    }

    return `/${path.reverse().join('/')}`;
  }

  getItemFromPath(path) {
    let parts     = path.split('/');
    let lastPart  = parts[parts.length - 1];

    let $items = this.select(`${ITEM_ELEMENT_TYPE}[value="${lastPart}"]`);
    for (let $item of Array.from($items || [])) {
      let itemPath = this.getItemPath($item);
      if (itemPath === path)
        return $item;
    }
  }

  getParentPopovers($item) {
    let parentNode  = Utils.getParentNode($item);
    let popovers    = [];

    while (parentNode) {
      if (parentNode === this)
        break;

      if (IS_POPOVER.test(parentNode.tagName))
        popovers.push(parentNode);

      parentNode = Utils.getParentNode(parentNode);
    }

    return popovers;
  }

  openToItem($item, force) {
    let $mainPopover    = this.findChildMenu($item);
    let $parentPopovers = this.getParentPopovers($item);

    this.closeAll($mainPopover, ...$parentPopovers);

    let isOpening = false;
    if (force == null)
      isOpening = !(($mainPopover || $parentPopovers[0] || {}).open);
    else if (force === false)
      isOpening = false;
    else if (force)
      isOpening = true;

    $parentPopovers.reverse().forEach(($popoverParent) => {
      $popoverParent.togglePopover(isOpening);
    });

    if ($mainPopover)
      $mainPopover.togglePopover(isOpening);

    this.updateHasFocusClasses();

    return isOpening;
  }

  findPreviousSiblingItem($item, wrapAround) {
    if (!$item)
      return;

    let sibling = $item.previousElementSibling;
    while (sibling) {
      if (IS_ITEM.test(sibling.tagName))
        return sibling;

      sibling = sibling.previousElementSibling;
    }

    if (wrapAround)
      return this.findLastSiblingItem($item);
  }

  findNextSiblingItem($item, wrapAround) {
    if (!$item)
      return;

    let sibling = $item.nextElementSibling;
    while (sibling) {
      if (IS_ITEM.test(sibling.tagName))
        return sibling;

      sibling = sibling.nextElementSibling;
    }

    if (wrapAround)
      return this.findFirstSiblingItem($item);
  }

  findFirstSiblingItem($item) {
    let parentNode = Utils.getParentNode($item);
    if (!parentNode)
      return;

    let firstSibling = parentNode.children[0];
    while (firstSibling) {
      if (firstSibling !== $item && IS_ITEM.test(firstSibling.tagName))
        return firstSibling;

      firstSibling = firstSibling.nextElementSibling;
    }
  }

  findLastSiblingItem($item) {
    let parentNode = Utils.getParentNode($item);
    if (!parentNode)
      return;

    let lastSibling = parentNode.children[parentNode.children.length - 1];
    while (lastSibling) {
      if (lastSibling !== $item && IS_ITEM.test(lastSibling.tagName))
        return lastSibling;

      lastSibling = lastSibling.previousElementSibling;
    }
  }

  findFirstChildItem($item) {
    let $childPopover = this.findChildMenu($item);
    if (!$childPopover)
      return;

    return $childPopover.querySelector(ITEM_ELEMENT_TYPE);
  }

  findParentItem($item) {
    let parentNode = Utils.getParentNode($item);
    if (!parentNode)
      return;

    return parentNode.closest(ITEM_ELEMENT_TYPE);
  }

  findRootParentItem($item) {
    let parentNode    = Utils.getParentNode($item);
    let finalElement  = null;

    while (parentNode) {
      if (parentNode === this)
        break;

      if (IS_ITEM.test(parentNode.tagName))
        finalElement = parentNode;

      parentNode = Utils.getParentNode(parentNode);
    }

    return finalElement;
  }

  getEncodedKeybindingForEvent(event) {
    return [
      event.altKey % 2,
      event.ctrlKey % 2,
      event.shiftKey % 2,
      event.metaKey % 2,
      event.code,
    ].join('');
  }

  updateItemKeyBinding($item, event) {
    let id = this.attr('id');
    if (!id)
      return;

    let command     = this.getItemPath($item);
    let encodedKey  = this.getEncodedKeybindingForEvent(event);

    this._keybindings[encodedKey] = command;

    console.log('Saving key binding for: ', command, event);
    Utils.storage.set('localStorage', 'mythix-ui-menu', id, 'keybindings', this._keybindings);
  }

  onHoveredItemChange($item) {
    if (!$item) {
      this.clearDebounce('itemHoverPendingOpen');
      return;
    }

    let autoOpenTime = this.autoOpenTime;
    if (!autoOpenTime)
      return;

    let isTopLevel = this.isTopLevelItem($item);
    this.debounce(() => {
      if (isTopLevel && !this.isAnyMenuOpen())
        return;

      if (this.findChildMenu($item))
        this.openToItem($item, true);
      else
        this.closeAll($item);
    }, (isTopLevel) ? 10 : autoOpenTime, 'itemHoverPendingOpen');
  }

  onMouseOver(event) {
    let $item = event.target.closest(ITEM_ELEMENT_TYPE);
    if (this._currentHoveredItem === $item)
      return;

    this._currentHoveredItem = $item || null;
  }

  onMouseOut(event) {
    let element = (event.relatedTarget) ? event.relatedTarget.closest('mythix-menu') : null;
    if (element !== this)
      this._currentHoveredItem = null;
  }

  onFocusIn(event) {
    let $item = event.target.closest(ITEM_ELEMENT_TYPE);
    if (this._currentHoveredItem === $item)
      return;

    this._currentHoveredItem = $item || null;
  }

  onFocusOut(event) {
    let element = (event.relatedTarget) ? event.relatedTarget.closest('mythix-menu') : null;
    if (element !== this)
      this._currentHoveredItem = null;
  }

  onKeyDown(event) {
    if (SHOULD_IGNORE_KEY.test(event.key))
      return;

    let $item = this._currentHoveredItem;
    let handled = false;

    if (!this.isAnyMenuOpen() && !$item) {
      let encodedKey  = this.getEncodedKeybindingForEvent(event);
      let command     = this._keybindings[encodedKey];

      if (!command)
        return;

      let $item = this.getItemFromPath(command);
      if ($item) {
        this.activateItem($item);
        return;
      }
    }

    // console.log(event);

    const focusItem = ($item) => {
      if (!$item)
        return;

      this.openToItem($item, true);

      $item.focus();

      handled = true;
    };

    const toggleItem = ($item, force) => {
      if (!$item)
        return;

      this.openToItem($item, force);
      handled = true;
    };

    if (event.code === 'Escape') {
      if (this.closeAll())
        handled = true;
    } else if ($item && (event.code === 'Space' || event.code === 'Enter')) {
      this.activateItem($item);
      handled = true;
    } else if ($item && event.code === 'ArrowRight') {
      if (!this.isTopLevelItem($item)) {
        if (this.isExpandableItem($item)) {
          if (!this.isItemExpanded($item)) {
            toggleItem($item);
          } else {
            let $childItem = this.findFirstChildItem($item);
            focusItem($childItem);
          }
        } else {
          let $rootItem = this.findRootParentItem($item);
          if ($rootItem) {
            let $nextItem = this.findNextSiblingItem($rootItem, WRAP_AROUND);
            if ($nextItem) {
              let $childMenuItem = this.findFirstChildItem($nextItem);
              focusItem($childMenuItem);
            }
          }
        }
      } else {
        let $nextItem = this.findNextSiblingItem($item, WRAP_AROUND);
        focusItem($nextItem);
      }
    } else if ($item && event.code === 'ArrowLeft') {
      if (!this.isTopLevelItem($item)) {
        let $parentItem = this.findParentItem($item);
        if ($parentItem) {
          if (this.isTopLevelItem($parentItem)) {
            let $previousItem = this.findPreviousSiblingItem($parentItem, WRAP_AROUND);
            if ($previousItem) {
              let $childMenuItem = this.findFirstChildItem($previousItem);
              focusItem($childMenuItem);
            }
          } else {
            focusItem($parentItem);
          }
        }
      } else {
        let $previousItem = this.findPreviousSiblingItem($item, WRAP_AROUND);
        focusItem($previousItem);
      }
    } else if ($item && event.code === 'ArrowDown') {
      if (this.isTopLevelItem($item)) {
        if (!this.isItemExpanded($item)) {
          toggleItem($item, true);
        } else {
          let $childItem = this.findFirstChildItem($item);
          focusItem($childItem);
        }
      } else {
        let $nextItem = this.findNextSiblingItem($item);
        focusItem($nextItem);
      }
    } else if ($item && event.code === 'ArrowUp') {
      if (this.isTopLevelItem($item)) {
        if (this.isItemExpanded($item))
          toggleItem($item, false);
      } else {
        let $previousItem = this.findPreviousSiblingItem($item);
        if ($previousItem) {
          focusItem($previousItem);
        } else {
          let $parentItem = this.findParentItem($item);
          if ($parentItem && this.isTopLevelItem($parentItem))
            focusItem($parentItem);
        }
      }
    } else if ($item && !this.isExpandableItem($item) && $item.matches(':hover') && (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)) {
      this.updateItemKeyBinding($item, event);
      handled = true;
    }

    if (handled) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }

  onClick(event) {
    if (!this.contains(event.target)) {
      this.closeAll();
      return;
    }

    let $item = this.getClickItem(event);
    if (!$item)
      return;

    event.stopPropagation();
    event.preventDefault();

    this.activateItem($item);
  }

  activateItem($item) {
    if (this.isExpandableItem($item)) {
      this.openToItem($item);
    } else {
      this.dispatchSelectedEvent($item);
      this.closeAll();
    }
  }
}

MythixUIMenu.register();
