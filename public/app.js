/**
 * دار الكحل — the shop front, in Arabic and English.
 *
 * Everything it knows comes from the API, and every change goes straight back
 * there. There is no "save" step and no local copy of the shop to keep in
 * step: a price edited on a phone is the price the next customer sees.
 *
 * Language is not a skin on top. It picks the typeface, the writing direction,
 * and which of the two columns a product's name comes out of — and when the
 * shopkeeper has only filled in one, the reader falls back to it rather than
 * showing an empty card.
 */
(function () {
  'use strict';

  var app = document.getElementById('app');

  var shop = null;      // { locked, user, settings, categories, products }
  var desk = null;      // the back office extras: stats, orders, customers, coupons
  var me = null;        // whoever is signed in
  var owner = false;
  var basket = [];
  var coupon = null;    // { code, discount }
  var filter = { cat: '', q: '', sort: 'new', loved: false };
  var lang = 'ar';

  var BASKET_KEY = 'dk.basket';
  var LANG_KEY = 'dk.lang';

  /* ================= words ================= */

  var T = {
    ar: {
      cart: 'السلة', signIn: 'تسجيل الدخول', signUp: 'حساب جديد', signOut: 'خروج',
      settings: 'الإعدادات', desk: 'لوحة التحكم', shopFront: 'المتجر', myOrders: 'طلباتي',
      myAccount: 'حسابي', adminMode: 'وضع الإدارة', enter: 'دخول', cancel: 'إلغاء',
      save: 'حفظ', saving: 'جارٍ الحفظ…', add: 'إضافة', edit: 'تعديل', remove: 'حذف',
      close: 'إغلاق', back: 'رجوع', done: 'تمام', moment: 'لحظة…', checking: 'جارٍ التحقّق…',
      retry: 'إعادة المحاولة', opening: 'جارٍ فتح المتجر…',

      email: 'البريد الإلكتروني', password: 'كلمة المرور', newPassword: 'كلمة المرور الجديدة',
      confirmPassword: 'تأكيد كلمة المرور', currentPassword: 'كلمة المرور الحالية',
      fullName: 'الاسم الكامل', phone: 'رقم الهاتف', city: 'المدينة', address: 'العنوان بالتفصيل',
      addressHint: 'الحي، الشارع، رقم البناية', notes: 'ملاحظات (اختياري)',
      notesHint: 'مثلاً: التوصيل بعد الساعة ٤ عصراً', pickCity: 'اختاري المدينة',
      phoneHint: '0599 000 000',

      doorLine: 'متجر خاص. سجّلي الدخول أو أنشئي حساباً لتتصفّحي المجموعة.',
      doorFoot: 'الدفع عند الاستلام · توصيل لكل مدن فلسطين',
      haveAccount: 'لديكِ حساب؟ سجّلي الدخول', noAccount: 'ليس لديكِ حساب؟ أنشئي واحداً',
      registerNote: 'الاسم والهاتف والعنوان تُملأ مرة واحدة، ثم يصبح الطلب ثلاث ضغطات.',
      welcome: 'أهلاً بكِ', welcomeBack: 'أهلاً بعودتكِ', welcomeDesk: 'أهلاً بكِ في لوحة التحكم',
      signedOut: 'تم تسجيل الخروج',

      search: 'ابحثي باسم المنتج أو الماركة…', sortBy: 'الترتيب',
      newest: 'الأحدث', priceLow: 'السعر: من الأقل', priceHigh: 'السعر: من الأعلى',
      biggestOff: 'الأكثر خصماً', all: 'الكل', loved: 'المفضّلة',
      noMatch: 'لا يوجد ما يطابق البحث', tryAnother: 'جرّبي قسماً آخر أو كلمة مختلفة.',
      nothingLoved: 'لا توجد مفضّلات بعد', lovedHint: 'اضغطي القلب على أي منتج ليظهر هنا.',

      inStock: 'متوفّر', onlyLeft: 'باقٍ {n} فقط', soldOut: 'نفدت الكمية', inStore: '{n} في المخزن',
      hidden: 'مخفي', housePick: 'اختيار الدار', saveOff: 'وفّري {n}٪',
      availability: 'التوفّر', section: 'القسم', delivery: 'التوصيل', days: 'أيام',
      addToCart: 'أضيفي إلى السلة', added: 'أُضيف إلى السلة', noBlurb: 'لا يوجد وصف لهذا المنتج بعد.',
      pickShade: 'اختاري الدرجة', shadeNeeded: 'اختاري درجة أولاً', shades: 'الدرجات',

      cartEmpty: 'السلة فارغة', cartEmptyHint: 'أضيفي ما يعجبكِ من المتجر وسنجهّز الطلب.',
      keepShopping: 'متابعة التسوق', subtotal: 'المجموع', shipping: 'التوصيل', free: 'مجاني',
      discount: 'الخصم', total: 'الإجمالي', checkout: 'إتمام الطلب',
      freeOverGap: 'أضيفي {amount} ليصبح التوصيل مجانياً', freeNow: 'التوصيل مجاني على هذا الطلب',
      couponCode: 'رمز الخصم', apply: 'تطبيق', couponOn: 'الرمز {code} — خصم {amount}',
      sendOrder: 'إرسال الطلب', sending: 'جارٍ الإرسال…',
      payOnDelivery: 'الدفع عند الاستلام. الطلب يصل المتجر فور إرساله، ونتواصل معكِ لتأكيده.',
      gotOrder: 'وصلنا طلبكِ', thankYou: 'شكراً لكِ', orderNo: 'رقم الطلب',
      orderThanks: 'الدفع عند الاستلام. سنتواصل معكِ على الرقم الذي كتبتِه لتأكيد الموعد.',

      orders: 'الطلبات', noOrders: 'لا توجد طلبات بعد.', noOrdersYou: 'لم تطلبي شيئاً بعد.',
      firstOrderHere: 'أول طلب سيظهر هنا فور إرساله.',
      needsAction: '{n} تحتاج متابعة', openOrders: 'طلبات مفتوحة', ofTotal: '{n} في المجمل',
      stNew: 'جديد', stConfirmed: 'مؤكّد', stSent: 'في الطريق', stDelivered: 'وصل', stCancelled: 'ملغى',
      doConfirm: 'تأكيد الطلب', doSent: 'أرسلته', doDelivered: 'وصل', doCancel: 'إلغاء',
      confirmTakesStock: 'تأكيد الطلب ينزّل الكمية من المخزن', orderUpdated: 'حُدّث الطلب',

      liveProducts: 'منتج معروض', unitsInStock: 'قطعة في المخزن', kinds: '{n} صنفاً',
      retailValue: 'قيمة المخزون بالبيع', atShopPrice: 'سعر المتجر',
      stockCost: 'تكلفة المخزون', atCost: 'ثمن الشراء',
      expectedGain: 'الربح المتوقّع', ifAllSold: 'لو بِيع كله',
      hiddenCount: '{n} مخفي', rateNote: 'الأرقام محسوبة على سعر صرف {rate} ₪ للدولار.',
      lowStock: 'مخزون على وشك النفاد', pieces: '{n} قطع', ranOut: 'نفد',
      takings: 'المبيعات — آخر ١٤ يوماً', takingsTotal: 'مجموع الفترة', noTakings: 'لا مبيعات في هذه الفترة بعد.',
      customers: 'الزبائن', customer: 'الزبونة', joined: 'انضمّت', spent: 'أنفقت',
      orderCount: 'طلبات', noCustomers: 'لا يوجد زبائن مسجّلون بعد.',

      coupons: 'رموز الخصم', code: 'الرمز', kind: 'النوع', value: 'القيمة',
      percent: 'نسبة ٪', amount: 'مبلغ ₪', minTotal: 'أقل مجموع', maxUses: 'أقصى استعمال',
      used: 'استُعمل', expires: 'ينتهي', unlimited: 'بلا حد', active: 'مفعّل',
      newCoupon: 'رمز جديد', noCoupons: 'لا توجد رموز خصم بعد.',

      sections: 'الأقسام', newSection: 'قسم جديد', sectionName: 'اسم القسم', sectionIcon: 'الرمز',
      sectionKey: 'المفتاح', sectionKeyHint: 'بالإنجليزية، بلا مسافات — مثل lips',

      product: 'المنتج', newProduct: 'منتج جديد', editProduct: 'تعديل منتج',
      productName: 'اسم المنتج', description: 'الوصف', brand: 'الماركة',
      sellPrice: 'سعر البيع (₪)', wasPrice: 'السعر قبل الخصم', buyCost: 'تكلفة الشراء ($)',
      quantity: 'الكمية المتوفّرة', showInShop: 'معروض في المتجر', featured: 'منتج مميّز',
      photos: 'الصور', dropPhotos: 'اضغطي لاختيار الصور أو اسحبيها هنا',
      photoHint: 'الصورة الأولى هي الرئيسية · حتى ٦ صور', main: 'رئيسية', processing: 'جارٍ معالجة الصور…',
      gainEach: 'ربح {amount} على القطعة · هامش {pct}٪', belowCost: 'سعر البيع أقل من التكلفة ({amount})',
      productSaved: 'حُفظ المنتج', productDeleted: 'حُذف المنتج', deleteAsk: 'حذف «{name}» من المتجر؟',
      addProduct: 'إضافة منتج', arabic: 'بالعربية', english: 'بالإنجليزية',
      englishOptional: 'الإنجليزية اختيارية — إن تركتِها فارغة سيظهر النص العربي للجميع.',

      shopSettings: 'إعدادات المتجر', shopName: 'اسم المتجر', shopTagline: 'وصف المتجر',
      topStrip: 'شريط الإعلان العلوي', whatsapp: 'رقم واتساب',
      whatsappHint: 'بمقدّمة الدولة وبلا + أو مسافات، مثل 970590000000',
      instagram: 'حساب إنستغرام', deliveryFee: 'أجرة التوصيل (₪)', freeOver: 'توصيل مجاني فوق (₪)',
      deliveryDays: 'مدة التوصيل', daysHint: 'بالأيام، مثل 2 – 4',
      usdRate: 'سعر صرف الدولار', usdHint: 'يُستعمل لحساب تكلفة المخزون والربح',
      privateShop: 'متجر خاص — لا بد من تسجيل الدخول', settingsSaved: 'حُفظت الإعدادات',
      defaultLang: 'لغة المتجر الافتراضية',

      credentials: 'بيانات الدخول', credentialsSaved: 'حُدّثت بيانات الدخول',
      profileSaved: 'حُفظت بياناتكِ', profile: 'بياناتي',
      pickStrong: 'المتجر على الإنترنت المفتوح، فاختاري كلمة مرور لا تُخمَّن.',
      passwordNag: 'المتجر ما زال يعمل بكلمة المرور الأصلية، وأي شخص يعرفها يستطيع الدخول.',
      fixNow: 'غيّريها الآن',

      firstSteps: 'الخطوات الأولى', firstStepsNote: 'أربع خطوات ويصبح المتجر جاهزاً للبيع.',
      stepPassword: 'غيّري كلمة المرور الأصلية', stepWhatsapp: 'أضيفي رقم واتساب المتجر',
      stepSection: 'راجعي الأقسام', stepProduct: 'أضيفي أول منتج',
      emptyShop: 'المتجر فارغ — وهذا صحيح', emptyShopOwner: 'لا شيء على الرفوف بعد. أضيفي أول منتج وسيظهر هنا فوراً.',
      emptyShopCustomer: 'لا توجد منتجات معروضة حالياً. عودي قريباً.',

      itemsInShop: 'صنفاً في المتجر', daysToDoor: 'أيام حتى الباب', freeAbove: 'توصيل مجاني فوقها',
      contactUs: 'تواصلي معنا', noWhatsapp: 'رقم واتساب المتجر غير مضبوط بعد.',
      codPalestine: 'الدفع عند الاستلام في كل مدن فلسطين.', madeIn: 'صُنع بحب في فلسطين',
      pickedByUs: 'نختار كل صنف بأنفسنا ونجرّبه قبل أن يدخل المتجر. اطلبي من الموقع وادفعي عند الاستلام.',

      noConnection: 'تعذّر الاتصال بالمتجر', needBoth: 'أدخلي البريد الإلكتروني وكلمة المرور',
      badSignIn: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      needName2: 'اكتبي الاسم الكامل', needEmail: 'اكتبي بريداً إلكترونياً صحيحاً',
      shortPassword: 'كلمة المرور قصيرة — ستة أحرف على الأقل',
      emailTaken: 'هذا البريد مسجَّل بالفعل — سجّلي الدخول',
      wrongCurrent: 'كلمة المرور الحالية غير صحيحة', mismatch: 'كلمتا المرور غير متطابقتين',
      needPhone: 'اكتبي رقم هاتف صحيحاً', needCity: 'اختاري المدينة', needAddress: 'اكتبي العنوان بالتفصيل',
      emptyBasket: 'السلة فارغة', nothingAvailable: 'لم يعد أيٌّ من هذه المنتجات متوفراً',
      needName: 'المنتج يحتاج اسماً', needPrice: 'سعر البيع لا بد أن يكون أكبر من صفر',
      needShadeName: 'كل درجة تحتاج اسماً', duplicateShade: 'لا يمكن تكرار اسم الدرجة',
      notAnImage: 'الصورة غير مقروءة — اختاري صورة JPEG أو PNG',
      imageTooBig: 'الصورة كبيرة جداً — اختاري صورة أصغر', tooManyPhotos: 'الحد الأقصى ٦ صور للمنتج',
      needCode: 'اكتبي رمز الخصم', unknownCode: 'رمز الخصم غير معروف', codeExpired: 'انتهت صلاحية الرمز',
      codeSpent: 'استُعمل هذا الرمز بالكامل', codeMinimum: 'الرمز يبدأ من {min}',
      needValue: 'قيمة الخصم لا بد أن تكون أكبر من صفر', percentTooBig: 'أكبر نسبة خصم ممكنة ٩٠٪',
      categoryInUse: 'لا يمكن حذف قسم فيه منتجات', needSlug: 'القسم يحتاج مفتاحاً',
      needCatName: 'القسم يحتاج اسماً', ownerOnly: 'هذه الصفحة للإدارة وحدها',
      badStatus: 'حالة غير معروفة', noSuchOrder: 'لا يوجد طلب بهذا الرقم',
      noSuchProduct: 'لا يوجد منتج بهذا الرقم', nothingToChange: 'لا يوجد شيء لتعديله',
      tooManyTries: 'محاولات كثيرة. انتظري عشر دقائق ثم جرّبي مرة أخرى.',
      discardAsk: 'تجاهل كل التغييرات غير المحفوظة؟',
    },
    en: {
      cart: 'Cart', signIn: 'Sign in', signUp: 'Create account', signOut: 'Sign out',
      settings: 'Settings', desk: 'Dashboard', shopFront: 'Shop', myOrders: 'My orders',
      myAccount: 'My account', adminMode: 'Owner mode', enter: 'Sign in', cancel: 'Cancel',
      save: 'Save', saving: 'Saving…', add: 'Add', edit: 'Edit', remove: 'Delete',
      close: 'Close', back: 'Back', done: 'Done', moment: 'One moment…', checking: 'Checking…',
      retry: 'Try again', opening: 'Opening the shop…',

      email: 'Email', password: 'Password', newPassword: 'New password',
      confirmPassword: 'Confirm password', currentPassword: 'Current password',
      fullName: 'Full name', phone: 'Phone number', city: 'City', address: 'Full address',
      addressHint: 'Neighbourhood, street, building', notes: 'Notes (optional)',
      notesHint: 'e.g. deliver after 4pm', pickCity: 'Choose a city',
      phoneHint: '0599 000 000',

      doorLine: 'A private shop. Sign in, or create an account to browse the collection.',
      doorFoot: 'Pay on delivery · Everywhere in Palestine',
      haveAccount: 'Already have an account? Sign in', noAccount: 'No account yet? Create one',
      registerNote: 'Name, phone and address are filled in once — after that an order is three taps.',
      welcome: 'Welcome', welcomeBack: 'Welcome back', welcomeDesk: 'Welcome to your dashboard',
      signedOut: 'Signed out',

      search: 'Search by product or brand…', sortBy: 'Sort',
      newest: 'Newest', priceLow: 'Price: low to high', priceHigh: 'Price: high to low',
      biggestOff: 'Biggest discount', all: 'All', loved: 'Favourites',
      noMatch: 'Nothing matches that', tryAnother: 'Try another section or a different word.',
      nothingLoved: 'No favourites yet', lovedHint: 'Tap the heart on anything to keep it here.',

      inStock: 'In stock', onlyLeft: 'Only {n} left', soldOut: 'Sold out', inStore: '{n} in stock',
      hidden: 'Hidden', housePick: "House pick", saveOff: 'Save {n}%',
      availability: 'Availability', section: 'Section', delivery: 'Delivery', days: 'days',
      addToCart: 'Add to cart', added: 'Added to your cart', noBlurb: 'No description yet.',
      pickShade: 'Choose a shade', shadeNeeded: 'Choose a shade first', shades: 'Shades',

      cartEmpty: 'Your cart is empty', cartEmptyHint: 'Add anything you like and we will get it ready.',
      keepShopping: 'Keep shopping', subtotal: 'Subtotal', shipping: 'Delivery', free: 'Free',
      discount: 'Discount', total: 'Total', checkout: 'Checkout',
      freeOverGap: 'Add {amount} for free delivery', freeNow: 'Delivery is free on this order',
      couponCode: 'Discount code', apply: 'Apply', couponOn: '{code} — {amount} off',
      sendOrder: 'Place order', sending: 'Sending…',
      payOnDelivery: 'Pay on delivery. Your order reaches the shop straight away and we call to confirm.',
      gotOrder: 'We have your order', thankYou: 'Thank you', orderNo: 'Order number',
      orderThanks: 'Pay on delivery. We will call the number you gave us to arrange a time.',

      orders: 'Orders', noOrders: 'No orders yet.', noOrdersYou: 'You have not ordered anything yet.',
      firstOrderHere: 'The first one will appear here the moment it is sent.',
      needsAction: '{n} need attention', openOrders: 'Open orders', ofTotal: '{n} in total',
      stNew: 'New', stConfirmed: 'Confirmed', stSent: 'On its way', stDelivered: 'Delivered', stCancelled: 'Cancelled',
      doConfirm: 'Confirm order', doSent: 'Mark as sent', doDelivered: 'Mark delivered', doCancel: 'Cancel',
      confirmTakesStock: 'Confirming takes the pieces off the shelf', orderUpdated: 'Order updated',

      liveProducts: 'Products live', unitsInStock: 'Pieces in stock', kinds: '{n} lines',
      retailValue: 'Stock at retail', atShopPrice: 'Shop price',
      stockCost: 'Stock at cost', atCost: 'What you paid',
      expectedGain: 'Expected profit', ifAllSold: 'If it all sells',
      hiddenCount: '{n} hidden', rateNote: 'Worked out at ₪{rate} to the dollar.',
      lowStock: 'Running low', pieces: '{n} left', ranOut: 'Out',
      takings: 'Takings — last 14 days', takingsTotal: 'Period total', noTakings: 'Nothing sold in this period yet.',
      customers: 'Customers', customer: 'Customer', joined: 'Joined', spent: 'Spent',
      orderCount: 'Orders', noCustomers: 'No registered customers yet.',

      coupons: 'Discount codes', code: 'Code', kind: 'Type', value: 'Value',
      percent: 'Percent %', amount: 'Amount ₪', minTotal: 'Minimum spend', maxUses: 'Max uses',
      used: 'Used', expires: 'Expires', unlimited: 'Unlimited', active: 'Active',
      newCoupon: 'New code', noCoupons: 'No discount codes yet.',

      sections: 'Sections', newSection: 'New section', sectionName: 'Section name', sectionIcon: 'Icon',
      sectionKey: 'Key', sectionKeyHint: 'Latin letters, no spaces — e.g. lips',

      product: 'Product', newProduct: 'New product', editProduct: 'Edit product',
      productName: 'Product name', description: 'Description', brand: 'Brand',
      sellPrice: 'Selling price (₪)', wasPrice: 'Price before discount', buyCost: 'What it cost you ($)',
      quantity: 'Quantity in stock', showInShop: 'Visible in the shop', featured: 'House pick',
      photos: 'Photographs', dropPhotos: 'Tap to choose photographs, or drag them here',
      photoHint: 'The first one is the main image · up to 6', main: 'Main', processing: 'Processing…',
      gainEach: '{amount} profit each · {pct}% margin', belowCost: 'Selling below what it cost ({amount})',
      productSaved: 'Product saved', productDeleted: 'Product deleted', deleteAsk: 'Delete “{name}” from the shop?',
      addProduct: 'Add a product', arabic: 'Arabic', english: 'English',
      englishOptional: 'English is optional — leave it blank and everyone sees the Arabic.',

      shopSettings: 'Shop settings', shopName: 'Shop name', shopTagline: 'Shop description',
      topStrip: 'Announcement strip', whatsapp: 'WhatsApp number',
      whatsappHint: 'With the country code, no + or spaces — e.g. 970590000000',
      instagram: 'Instagram handle', deliveryFee: 'Delivery charge (₪)', freeOver: 'Free delivery over (₪)',
      deliveryDays: 'Delivery time', daysHint: 'In days, e.g. 2 – 4',
      usdRate: 'Dollar exchange rate', usdHint: 'Used to work out stock cost and profit',
      privateShop: 'Private shop — signing in is required', settingsSaved: 'Settings saved',
      defaultLang: 'Default shop language',

      credentials: 'Sign-in details', credentialsSaved: 'Sign-in details updated',
      profileSaved: 'Your details are saved', profile: 'My details',
      pickStrong: 'The shop is on the open internet, so choose a password nobody would guess.',
      passwordNag: 'The shop is still using the password it shipped with — anyone who knows it can get in.',
      fixNow: 'Change it now',

      firstSteps: 'First steps', firstStepsNote: 'Four steps and the shop is ready to sell.',
      stepPassword: 'Change the original password', stepWhatsapp: 'Add the shop WhatsApp number',
      stepSection: 'Check your sections', stepProduct: 'Add your first product',
      emptyShop: 'The shop is empty — as it should be', emptyShopOwner: 'Nothing on the shelves yet. Add your first product and it appears here straight away.',
      emptyShopCustomer: 'Nothing on the shelves right now. Do come back soon.',

      itemsInShop: 'lines in the shop', daysToDoor: 'days to your door', freeAbove: 'free delivery above',
      contactUs: 'Talk to us', noWhatsapp: 'No WhatsApp number set yet.',
      codPalestine: 'Pay on delivery, everywhere in Palestine.', madeIn: 'Made with love in Palestine',
      pickedByUs: 'We choose and try every line ourselves before it reaches the shop. Order here and pay when it arrives.',

      noConnection: 'Could not reach the shop', needBoth: 'Enter your email and password',
      badSignIn: 'That email or password is not right',
      needName2: 'Enter your full name', needEmail: 'Enter a valid email address',
      shortPassword: 'That password is too short — six characters at least',
      emailTaken: 'That email already has an account — sign in instead',
      wrongCurrent: 'Your current password is not right', mismatch: 'Those passwords do not match',
      needPhone: 'Enter a valid phone number', needCity: 'Choose a city', needAddress: 'Enter your full address',
      emptyBasket: 'Your cart is empty', nothingAvailable: 'None of those are available any more',
      needName: 'The product needs a name', needPrice: 'The selling price must be more than zero',
      needShadeName: 'Every shade needs a name', duplicateShade: 'Two shades cannot share a name',
      notAnImage: 'That file is not readable — choose a JPEG or PNG',
      imageTooBig: 'That photograph is too large — choose a smaller one', tooManyPhotos: 'Six photographs is the limit',
      needCode: 'Enter a discount code', unknownCode: 'That code is not recognised', codeExpired: 'That code has expired',
      codeSpent: 'That code has been fully used', codeMinimum: 'That code starts at {min}',
      needValue: 'The discount must be more than zero', percentTooBig: '90% is the largest discount',
      categoryInUse: 'A section with products in it cannot be deleted', needSlug: 'The section needs a key',
      needCatName: 'The section needs a name', ownerOnly: 'That is for the shopkeeper only',
      badStatus: 'Unknown status', noSuchOrder: 'No order with that number',
      noSuchProduct: 'No product with that number', nothingToChange: 'Nothing to change',
      tooManyTries: 'Too many attempts. Wait ten minutes and try again.',
      discardAsk: 'Discard every unsaved change?',
    },
  };

  function t(key, vars) {
    var s = (T[lang] && T[lang][key]) || (T.ar && T.ar[key]) || key;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, name) {
      return name in vars ? String(vars[name]) : m;
    });
  }

  var CITIES = {
    ar: ['القدس', 'رام الله', 'البيرة', 'نابلس', 'الخليل', 'بيت لحم', 'بيت جالا', 'بيت ساحور',
      'جنين', 'طولكرم', 'قلقيلية', 'أريحا', 'سلفيت', 'طوباس', 'غزة', 'خان يونس', 'رفح',
      'دير البلح', 'الناصرة', 'حيفا', 'يافا', 'عكا', 'أم الفحم', 'الطيبة'],
    en: ['Jerusalem', 'Ramallah', 'Al-Bireh', 'Nablus', 'Hebron', 'Bethlehem', 'Beit Jala', 'Beit Sahour',
      'Jenin', 'Tulkarm', 'Qalqilya', 'Jericho', 'Salfit', 'Tubas', 'Gaza', 'Khan Younis', 'Rafah',
      'Deir al-Balah', 'Nazareth', 'Haifa', 'Jaffa', 'Acre', 'Umm al-Fahm', 'Tayibe'],
  };

  var SORTS = ['new', 'low', 'high', 'sale'];
  var SORT_WORD = { new: 'newest', low: 'priceLow', high: 'priceHigh', sale: 'biggestOff' };
  var STATUS_WORD = {
    new: 'stNew', confirmed: 'stConfirmed', sent: 'stSent', delivered: 'stDelivered', cancelled: 'stCancelled',
  };

  /* ================= talking to the shop ================= */

  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.ok) return data;
        var err = new Error(data.error || t('noConnection'));
        err.status = res.status;
        err.key = data.key;
        err.extra = data;
        throw err;
      });
    });
  }

  /** Errors arrive as a key so they can be read in whichever language is on. */
  function say(err) {
    if (err && err.key && T[lang] && T[lang][err.key]) {
      return t(err.key, { min: ils(err.extra && err.extra.min), count: err.extra && err.extra.count });
    }
    return (err && err.message) || t('noConnection');
  }

  function load() {
    return api('GET', '/shop').then(function (data) {
      shop = data;
      me = data.user || null;
      owner = Boolean(me && me.owner);
      if (!owner) { desk = null; return null; }
      return api('GET', '/desk').then(function (full) {
        shop = full;
        me = full.user;
        desk = full;
      });
    }).then(function () {
      applyLang(chooseLang());
      render();
    })['catch'](function (err) {
      app.innerHTML = '<div class="loading"><p>' + esc(say(err)) + '</p>'
        + '<p style="margin-top:14px"><button class="btn" id="retry">' + esc(t('retry')) + '</button></p></div>';
      var retry = document.getElementById('retry');
      if (retry) retry.addEventListener('click', function () { load(); });
    });
  }

  /* ================= language ================= */

  function chooseLang() {
    var stored = null;
    try { stored = localStorage.getItem(LANG_KEY); } catch (e) { stored = null; }
    if (me && me.lang && !stored) return me.lang;
    if (stored === 'ar' || stored === 'en') return stored;
    return (shop && shop.settings && shop.settings.defaultLang) || 'ar';
  }

  function applyLang(next) {
    lang = next === 'en' ? 'en' : 'ar';
    var root = document.documentElement;
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
  }

  function setLang(next) {
    if (next === lang) return;
    applyLang(next);
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    if (me) api('PATCH', '/profile', { lang: lang })['catch'](function () {});
    render();
  }

  /* ================= helpers ================= */

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ils(n) {
    var v = Number(n) || 0;
    return (Math.abs(v % 1) < 0.005 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)) + ' ₪';
  }
  function when(iso) {
    var d = new Date(iso);
    if (!iso || isNaN(d)) return '—';
    // Latin digits in both languages, so a date never disagrees with a price.
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn',
      { day: 'numeric', month: 'short', year: '2-digit' });
  }
  /** The Arabic field, or the English one, with a fallback to whichever exists. */
  function pick(obj, arKey, enKey) {
    if (!obj) return '';
    var first = lang === 'en' ? obj[enKey] : obj[arKey];
    var other = lang === 'en' ? obj[arKey] : obj[enKey];
    return String(first || '').trim() || String(other || '').trim() || '';
  }
  function pname(p) { return pick(p, 'name', 'name_en'); }
  function pblurb(p) { return pick(p, 'blurb', 'blurb_en'); }
  function cname(c) { return pick(c, 'name', 'name_en'); }
  function shopName() { return pick(shop.settings, 'name_ar', 'name_en'); }
  function otherName() {
    var s = shop.settings;
    return String(lang === 'en' ? s.name_ar : s.name_en || '').trim();
  }
  function shopTag() { return pick(shop.settings, 'tagline_ar', 'tagline_en'); }
  function shopStrip() { return pick(shop.settings, 'strip_ar', 'strip_en'); }

  function byId(id) {
    return shop.products.filter(function (p) { return p.id === id; })[0];
  }
  function cat(slug) {
    return shop.categories.filter(function (c) { return c.slug === slug; })[0];
  }
  function catName(slug) { var c = cat(slug); return c ? cname(c) : ''; }
  function catIcon(slug) { var c = cat(slug); return c ? c.icon : '◆'; }
  function tint(p) { return (p.id * 47) % 360; }
  function photoUrl(ref) {
    return /^data:image\//.test(ref) ? ref : '/photo/' + encodeURIComponent(ref);
  }

  function toast(msg, kind) {
    var host = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 260);
    }, 3600);
  }

  /** A button that means it: disabled and relabelled while the request is out. */
  function busy(button, label) {
    if (!button) return function () {};
    var was = button.textContent;
    button.disabled = true;
    button.textContent = label || t('moment');
    return function () { button.disabled = false; button.textContent = was; };
  }

  function wash(p, glyph) {
    return '<div class="wash"><i class="wash-bg" style="filter:hue-rotate(' + tint(p) + 'deg)"></i>'
      + '<em>' + esc(glyph || catIcon(p.cat)) + '</em>'
      + (p.house ? '<span>' + esc(p.house) + '</span>' : '') + '</div>';
  }
  function facePhoto(p, big) {
    var first = (p.photos || [])[0];
    return first
      ? '<img src="' + esc(photoUrl(first)) + '" alt="' + esc(pname(p)) + '"' + (big ? '' : ' loading="lazy"') + '>'
      : wash(p);
  }
  function shadeName(v) { return pick(v, 'name', 'name_en'); }

  /* ================= basket ================= */

  function keepBasket() {
    try { localStorage.setItem(BASKET_KEY, JSON.stringify(basket)); } catch (e) {}
  }
  try { basket = JSON.parse(localStorage.getItem(BASKET_KEY) || '[]') || []; } catch (e) { basket = []; }

  function lineKey(id, variantId) { return id + '::' + (variantId || ''); }

  function lines() {
    if (!shop) return [];
    return basket.map(function (b) {
      var p = byId(b.id);
      if (!p || !p.live) return null;
      var shade = null;
      if (p.variants.length) {
        shade = p.variants.filter(function (v) { return v.id === b.variantId; })[0];
        if (!shade || shade.stock <= 0) return null;
      } else if (p.stock <= 0) {
        return null;
      }
      var ceiling = shade ? shade.stock : p.stock;
      return { p: p, shade: shade, qty: Math.max(1, Math.min(b.qty, ceiling)), ceiling: ceiling };
    }).filter(Boolean);
  }

  function totals(ls) {
    var sub = ls.reduce(function (s, l) { return s + l.p.price * l.qty; }, 0);
    var off = coupon ? Math.min(coupon.discount, sub) : 0;
    var free = Number(shop.settings.freeOver) || 0;
    var flat = Number(shop.settings.shipping) || 0;
    var payable = sub - off;
    var ship = ls.length === 0 ? 0 : (free > 0 && payable >= free ? 0 : flat);
    return { sub: sub, off: off, ship: ship, sum: payable + ship, free: free };
  }

  function count() { return lines().reduce(function (n, l) { return n + l.qty; }, 0); }

  function addToBasket(id, variantId, qty) {
    var p = byId(id);
    if (!p) return;
    var ceiling = p.stock;
    if (p.variants.length) {
      var shade = p.variants.filter(function (v) { return v.id === variantId; })[0];
      if (!shade) { toast(t('shadeNeeded'), 'bad'); return; }
      ceiling = shade.stock;
    }
    if (ceiling <= 0) return;
    var key = lineKey(id, variantId);
    var found = basket.filter(function (b) { return lineKey(b.id, b.variantId) === key; })[0];
    if (found) found.qty = Math.min(ceiling, found.qty + (qty || 1));
    else basket.push({ id: id, variantId: variantId || null, qty: Math.min(ceiling, qty || 1) });
    keepBasket();
    refreshCart();
    toast(t('added'), 'good');
  }

  function refreshCart() {
    var host = document.getElementById('cartCount');
    if (!host) return;
    var n = count();
    host.innerHTML = n ? '<b class="num">' + n + '</b>' : '';
  }

  /* ================= sheets ================= */

  function openSheet(html, cls) {
    var scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.innerHTML = '<div class="sheet ' + (cls || '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(scrim);
    document.body.style.overflow = 'hidden';

    var sheet = scrim.firstElementChild;
    var came = document.activeElement;

    function reachable() {
      var sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),'
        + 'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
      return Array.prototype.slice.call(sheet.querySelectorAll(sel))
        .filter(function (el) { return el.offsetParent !== null; });
    }
    function shut() {
      scrim.remove();
      document.removeEventListener('keydown', onKey);
      if (!document.querySelector('.scrim')) document.body.style.overflow = '';
      if (came && came.focus) { try { came.focus({ preventScroll: true }); } catch (e) {} }
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); shut(); return; }
      if (e.key !== 'Tab') return;
      var f = reachable();
      if (!f.length) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    scrim.addEventListener('mousedown', function (e) { if (e.target === scrim) shut(); });
    scrim.querySelectorAll('[data-shut]').forEach(function (b) { b.addEventListener('click', shut); });
    setTimeout(function () {
      var wanted = sheet.querySelector('[data-focus]') || reachable()[0];
      // Not on a phone: focusing a field throws the keyboard up over the sheet
      // before anyone has read it.
      if (wanted && window.innerWidth > 620) wanted.focus();
    }, 40);

    return { root: scrim, shut: shut, q: function (s) { return scrim.querySelector(s); } };
  }

  function field(id, label, opts) {
    var o = opts || {};
    return '<div class="f' + (o.flat ? '" style="margin-bottom:0' : '') + '">'
      + '<label for="' + id + '">' + esc(label) + '</label>'
      + '<input id="' + id + '" type="' + (o.type || 'text') + '"'
      + (o.dir ? ' dir="' + o.dir + '"' : '')
      + (o.value !== undefined && o.value !== null ? ' value="' + esc(o.value) + '"' : '')
      + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '')
      + (o.autocomplete ? ' autocomplete="' + o.autocomplete + '"' : '')
      + (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '')
      + (o.max ? ' maxlength="' + o.max + '"' : '')
      + (o.min !== undefined ? ' min="' + o.min + '"' : '')
      + (o.step ? ' step="' + o.step + '"' : '')
      + (o.focus ? ' data-focus' : '') + '>'
      + (o.note ? '<p class="note">' + esc(o.note) + '</p>' : '')
      + '</div>';
  }

  function citySelect(id, value) {
    return '<div class="f"><label for="' + id + '">' + esc(t('city')) + '</label>'
      + '<select id="' + id + '"><option value="">' + esc(t('pickCity')) + '</option>'
      + CITIES[lang].map(function (c, i) {
        var arabic = CITIES.ar[i];
        var chosen = value === c || value === arabic;
        return '<option value="' + esc(c) + '"' + (chosen ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join('') + '</select></div>';
  }

  /* ================= the front door ================= */

  function renderDoor() {
    var s = shop.settings;
    var mode = 'in';

    app.innerHTML = '<div class="shell door"><div class="door-card">'
      + '<div class="door-crown"><span>' + esc(s.mark || 'د') + '</span></div>'
      + '<div class="door-body"><h2>' + esc(shopName()) + '</h2>'
        + '<p>' + esc(shopTag() || t('doorLine')) + '</p></div>'
      + '<div class="door-form">'
        + '<div class="door-tabs">'
          + '<button id="tabIn" aria-pressed="true">' + esc(t('signIn')) + '</button>'
          + '<button id="tabUp" aria-pressed="false">' + esc(t('signUp')) + '</button>'
        + '</div>'
        + '<div id="doorErr"></div>'
        + '<div id="doorFields"></div>'
        + '<button class="btn btn-wide" id="doorGo" style="margin-top:4px">' + esc(t('enter')) + '</button>'
      + '</div>'
      + '<div class="door-foot">' + esc(t('doorFoot'))
        + '<div style="margin-top:12px" id="doorLangs"></div></div>'
    + '</div></div>';

    document.getElementById('doorLangs').innerHTML = langSwitch();
    wireLangs();

    function paint() {
      var host = document.getElementById('doorFields');
      host.innerHTML = mode === 'in'
        ? field('dMail', t('email'), { type: 'email', dir: 'ltr', autocomplete: 'username', focus: true })
          + field('dPass', t('password'), { type: 'password', dir: 'ltr', autocomplete: 'current-password', flat: true })
        : field('dName', t('fullName'), { max: 80, autocomplete: 'name', focus: true })
          + field('dMail', t('email'), { type: 'email', dir: 'ltr', autocomplete: 'username' })
          + field('dPass', t('password'), { type: 'password', dir: 'ltr', autocomplete: 'new-password' })
          + field('dPhone', t('phone'), { dir: 'ltr', inputmode: 'tel', placeholder: t('phoneHint'), autocomplete: 'tel' })
          + '<p class="note" style="color:var(--ink-mute);font-size:12.5px;margin-bottom:4px">'
            + esc(t('registerNote')) + '</p>';
      document.getElementById('tabIn').setAttribute('aria-pressed', String(mode === 'in'));
      document.getElementById('tabUp').setAttribute('aria-pressed', String(mode === 'up'));
      document.getElementById('doorGo').textContent = mode === 'in' ? t('enter') : t('signUp');
      document.getElementById('doorErr').innerHTML = '';
      host.querySelectorAll('input').forEach(function (el) {
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); go(); }
        });
      });
    }

    function go() {
      var button = document.getElementById('doorGo');
      var fail = function (err) {
        busyOff();
        document.getElementById('doorErr').innerHTML = '<div class="alert">' + esc(say(err)) + '</div>';
      };
      var busyOff = busy(button, t('checking'));
      var body;
      var path;
      if (mode === 'in') {
        body = {
          email: (document.getElementById('dMail') || {}).value,
          password: (document.getElementById('dPass') || {}).value,
        };
        path = '/session';
      } else {
        body = {
          name: (document.getElementById('dName') || {}).value,
          email: (document.getElementById('dMail') || {}).value,
          password: (document.getElementById('dPass') || {}).value,
          phone: (document.getElementById('dPhone') || {}).value,
          lang: lang,
        };
        path = '/register';
      }
      api('POST', path, body).then(function () {
        return load();
      }).then(function () {
        window.scrollTo(0, 0);
        toast(owner ? t('welcomeDesk') : t('welcome'), 'good');
      })['catch'](fail);
    }

    document.getElementById('tabIn').addEventListener('click', function () { mode = 'in'; paint(); });
    document.getElementById('tabUp').addEventListener('click', function () { mode = 'up'; paint(); });
    document.getElementById('doorGo').addEventListener('click', go);
    paint();
  }

  function signOut() {
    api('DELETE', '/session').then(function () {
      coupon = null;
      return load();
    }).then(function () { toast(t('signedOut')); })
    ['catch'](function (err) { toast(say(err), 'bad'); });
  }

  /* ---------- my details ---------- */

  function editProfile() {
    if (!me) return;
    var sheet = openSheet(
      '<div class="sheet-head"><h3>' + esc(t('profile')) + '</h3>'
      + '<button class="x" data-shut aria-label="' + esc(t('close')) + '">✕</button></div>'
      + '<div class="sheet-body">'
        + '<div id="pErr"></div>'
        + field('pName', t('fullName'), { max: 80, value: me.name, autocomplete: 'name', focus: true })
        + '<div class="two">'
          + field('pPhone', t('phone'), { dir: 'ltr', inputmode: 'tel', value: me.phone, autocomplete: 'tel' })
          + citySelect('pCity', me.city)
        + '</div>'
        + field('pAddr', t('address'), { max: 200, value: me.address, placeholder: t('addressHint') })
        + '<div style="border-top:1px solid var(--line);margin:20px 0 16px"></div>'
        + '<h4 style="font-family:var(--display);font-weight:500;font-size:17px;margin-bottom:12px">'
          + esc(t('credentials')) + '</h4>'
        + field('pCur', t('currentPassword'), { type: 'password', dir: 'ltr', autocomplete: 'current-password' })
        + field('pMail', t('email'), { type: 'email', dir: 'ltr', value: me.email, autocomplete: 'username' })
        + '<div class="two">'
          + field('pPass', t('newPassword'), { type: 'password', dir: 'ltr', autocomplete: 'new-password' })
          + field('pPass2', t('confirmPassword'), { type: 'password', dir: 'ltr', autocomplete: 'new-password' })
        + '</div>'
        + '<p class="note" style="color:var(--ink-mute);font-size:12.5px">' + esc(t('pickStrong')) + '</p>'
      + '</div>'
      + '<div class="sheet-foot"><button class="btn btn-line" data-shut>' + esc(t('cancel')) + '</button>'
      + '<button class="btn" id="pSave">' + esc(t('save')) + '</button></div>', 'sheet-wide');

    sheet.q('#pSave').addEventListener('click', function () {
      var pass = sheet.q('#pPass').value;
      var fail = function (msg) { sheet.q('#pErr').innerHTML = '<div class="alert">' + esc(msg) + '</div>'; };
      if (pass && pass !== sheet.q('#pPass2').value) { fail(t('mismatch')); return; }
      var off = busy(sheet.q('#pSave'), t('saving'));

      api('PATCH', '/profile', {
        name: sheet.q('#pName').value,
        phone: sheet.q('#pPhone').value,
        city: sheet.q('#pCity').value,
        address: sheet.q('#pAddr').value,
      }).then(function () {
        var wantsNew = pass || sheet.q('#pMail').value.trim().toLowerCase() !== me.email;
        if (!wantsNew) return null;
        return api('POST', '/account', {
          current: sheet.q('#pCur').value,
          email: sheet.q('#pMail').value,
          password: pass || sheet.q('#pCur').value,
        });
      }).then(function () {
        sheet.shut();
        return load();
      }).then(function () { toast(t('profileSaved'), 'good'); })
      ['catch'](function (err) { off(); fail(say(err)); });
    });
  }

  /* ---------- my orders ---------- */

  function showMyOrders() {
    var sheet = openSheet(
      '<div class="sheet-head"><h3>' + esc(t('myOrders')) + '</h3>'
      + '<button class="x" data-shut aria-label="' + esc(t('close')) + '">✕</button></div>'
      + '<div class="sheet-body" id="mineBody"><div class="loading">' + esc(t('moment')) + '</div></div>',
      'sheet-wide');

    api('GET', '/orders/mine').then(function (data) {
      var body = sheet.q('#mineBody');
      if (!data.orders.length) {
        body.innerHTML = '<div class="blank"><h4>' + esc(t('noOrdersYou')) + '</h4>'
          + '<p>' + esc(t('firstOrderHere')) + '</p></div>';
        return;
      }
      var flow = ['new', 'confirmed', 'sent', 'delivered'];
      body.innerHTML = data.orders.map(function (o) {
        var at = flow.indexOf(o.status);
        return '<div class="order" style="padding-inline:0">'
          + '<div class="order-top">'
            + '<span class="pill pill-' + esc(o.status) + '">' + esc(t(STATUS_WORD[o.status])) + '</span>'
            + '<span class="order-ref">' + esc(o.ref) + '</span>'
            + '<span class="order-where">' + esc(when(o.created_at)) + '</span>'
            + '<span class="order-total">' + ils(o.total) + '</span>'
          + '</div>'
          + '<div class="order-lines">' + o.items.map(function (i) {
            return esc(pick(i, 'name', 'name_en')) + (i.variant_name ? ' · ' + esc(i.variant_name) : '')
              + ' × ' + i.qty;
          }).join(' · ') + '</div>'
          + (o.status === 'cancelled' ? ''
            : '<div class="track">' + flow.map(function (st, idx) {
              return '<div class="' + (idx <= at ? 'on' : '') + '">' + esc(t(STATUS_WORD[st])) + '</div>';
            }).join('') + '</div>')
          + (o.discount > 0
            ? '<div class="order-where">' + esc(t('discount')) + ' ' + ils(o.discount)
              + (o.coupon_code ? ' · ' + esc(o.coupon_code) : '') + '</div>'
            : '')
        + '</div>';
      }).join('');
    })['catch'](function (err) {
      sheet.q('#mineBody').innerHTML = '<div class="alert">' + esc(say(err)) + '</div>';
    });
  }

  /* ---------- product detail ---------- */

  function showProduct(id) {
    var p = byId(id);
    if (!p) return;
    var photos = (p.photos || []).map(photoUrl);
    var qty = 1;
    var sale = p.was > p.price;
    var live = p.variants.filter(function (v) { return v.stock > 0; });
    var chosen = p.variants.length ? (live[0] ? live[0].id : null) : null;
    var ceiling = function () {
      if (!p.variants.length) return p.stock;
      var v = p.variants.filter(function (x) { return x.id === chosen; })[0];
      return v ? v.stock : 0;
    };

    var sheet = openSheet(
      '<div class="sheet-head"><h3>' + esc(catName(p.cat) || t('product')) + '</h3>'
      + '<button class="x" data-shut aria-label="' + esc(t('close')) + '">✕</button></div>'
      + '<div class="sheet-body"><div class="detail">'
        + '<div><div class="detail-shot">'
          + (photos.length
            ? '<img id="bigshot" src="' + esc(photos[0]) + '" alt="' + esc(pname(p)) + '">'
            : wash(p))
        + '</div>'
        + (photos.length > 1
          ? '<div class="thumbs">' + photos.map(function (u, i) {
            return '<button data-pick="' + esc(u) + '" aria-current="' + (i === 0) + '">'
              + '<img src="' + esc(u) + '" alt=""></button>';
          }).join('') + '</div>'
          : '')
        + '</div>'
        + '<div>'
          + (p.house ? '<div class="house">' + esc(p.house) + '</div>' : '')
          + '<h4>' + esc(pname(p)) + '</h4>'
          + '<div class="detail-cost"><b class="num">' + ils(p.price) + '</b>'
            + (sale
              ? '<s class="num">' + ils(p.was) + '</s>'
                + '<span class="badge">' + esc(t('saveOff', { n: Math.round((1 - p.price / p.was) * 100) })) + '</span>'
              : '') + '</div>'
          + '<dl class="spec">'
            + '<div><dt>' + esc(t('availability')) + '</dt><dd>' + (p.stock > 0
              ? '<span class="state ' + (p.stock <= 3 ? 's-low' : 's-ok') + '">'
                + (p.stock <= 3 ? esc(t('onlyLeft', { n: p.stock })) : esc(t('inStock'))) + '</span>'
              : '<span class="state s-gone">' + esc(t('soldOut')) + '</span>') + '</dd></div>'
            + '<div><dt>' + esc(t('section')) + '</dt><dd>' + esc(catName(p.cat)) + '</dd></div>'
            + '<div><dt>' + esc(t('delivery')) + '</dt><dd>' + esc(shop.settings.days || '2 – 4')
              + ' ' + esc(t('days')) + '</dd></div>'
          + '</dl>'
          + (p.variants.length
            ? '<div class="flabel">' + esc(t('pickShade')) + '</div><div class="shades" id="shades">'
              + p.variants.map(function (v) {
                return '<button class="shade" data-shade="' + esc(v.id) + '"'
                  + ' aria-pressed="' + (v.id === chosen) + '"' + (v.stock <= 0 ? ' disabled' : '') + '>'
                  + (v.swatch ? '<i style="background:' + esc(v.swatch) + '"></i>' : '')
                  + esc(shadeName(v)) + '</button>';
              }).join('') + '</div>'
            : '')
          + '<p class="blurb" style="margin-top:14px">' + esc(pblurb(p) || t('noBlurb')) + '</p>'
          + (p.stock > 0
            ? '<div style="display:flex;gap:10px;align-items:center;margin-top:20px;flex-wrap:wrap">'
              + '<div class="stepper"><button data-step="-1" aria-label="−">−</button>'
              + '<span id="qty" class="num">1</span>'
              + '<button data-step="1" aria-label="+">+</button></div>'
              + '<button class="btn" id="toBasket" style="flex:1;min-width:150px">'
              + esc(t('addToCart')) + '</button>'
              + '</div>'
            : '<p style="margin-top:20px" class="state s-gone">' + esc(t('soldOut')) + '</p>')
        + '</div>'
      + '</div></div>', 'sheet-wide');

    sheet.root.querySelectorAll('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () {
        sheet.q('#bigshot').src = b.getAttribute('data-pick');
        sheet.root.querySelectorAll('[data-pick]').forEach(function (o) { o.setAttribute('aria-current', 'false'); });
        b.setAttribute('aria-current', 'true');
      });
    });
    sheet.root.querySelectorAll('[data-shade]').forEach(function (b) {
      b.addEventListener('click', function () {
        chosen = b.getAttribute('data-shade');
        sheet.root.querySelectorAll('[data-shade]').forEach(function (o) {
          o.setAttribute('aria-pressed', String(o === b));
        });
        qty = Math.min(qty, Math.max(1, ceiling()));
        if (sheet.q('#qty')) sheet.q('#qty').textContent = qty;
      });
    });
    sheet.root.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        qty = Math.max(1, Math.min(ceiling(), qty + Number(b.getAttribute('data-step'))));
        sheet.q('#qty').textContent = qty;
      });
    });
    var add = sheet.q('#toBasket');
    if (add) {
      add.addEventListener('click', function () {
        if (p.variants.length && !chosen) { toast(t('shadeNeeded'), 'bad'); return; }
        addToBasket(p.id, chosen, qty);
        sheet.shut();
      });
    }
  }

  /* ---------- basket ---------- */

  function showBasket() {
    var sheet = openSheet(
      '<div class="sheet-head"><h3>' + esc(t('cart')) + '</h3>'
      + '<button class="x" data-shut aria-label="' + esc(t('close')) + '">✕</button></div>'
      + '<div class="sheet-body" id="cartBody"></div>'
      + '<div class="sheet-foot" id="cartFoot" style="justify-content:stretch"></div>');

    function paint() {
      var ls = lines();
      var body = sheet.q('#cartBody');
      var foot = sheet.q('#cartFoot');

      if (ls.length === 0) {
        body.innerHTML = '<div class="blank"><h4>' + esc(t('cartEmpty')) + '</h4>'
          + '<p>' + esc(t('cartEmptyHint')) + '</p></div>';
        foot.innerHTML = '<button class="btn btn-line btn-wide" id="keepOn">' + esc(t('keepShopping')) + '</button>';
        foot.querySelector('#keepOn').addEventListener('click', sheet.shut);
        return;
      }

      body.innerHTML = ls.map(function (l) {
        var key = lineKey(l.p.id, l.shade ? l.shade.id : null);
        return '<div class="line">'
          + '<div class="line-shot">' + facePhoto(l.p) + '</div>'
          + '<div class="line-info"><div class="line-name">' + esc(pname(l.p))
            + (l.shade ? ' <span class="order-ref">· ' + esc(shadeName(l.shade)) + '</span>' : '') + '</div>'
            + '<div class="line-sub">' + ils(l.p.price) + ' × ' + l.qty + ' = ' + ils(l.p.price * l.qty) + '</div>'
            + '<div class="line-act"><div class="stepper">'
              + '<button data-less="' + esc(key) + '"' + (l.qty <= 1 ? ' disabled' : '') + ' aria-label="−">−</button>'
              + '<span>' + l.qty + '</span>'
              + '<button data-more="' + esc(key) + '"' + (l.qty >= l.ceiling ? ' disabled' : '') + ' aria-label="+">+</button>'
            + '</div><button class="pull" data-drop="' + esc(key) + '">' + esc(t('remove')) + '</button></div>'
          + '</div></div>';
      }).join('');

      var tt = totals(ls);
      var gap = Math.max(0, tt.free - (tt.sub - tt.off));
      foot.innerHTML = '<div style="width:100%">'
        + (coupon
          ? '<div class="coupon-on"><span>'
            + esc(t('couponOn', { code: coupon.code, amount: ils(tt.off) }))
            + '</span><button id="dropCoupon">✕</button></div>'
          : '<div class="coupon-row"><input id="cCode" placeholder="' + esc(t('couponCode')) + '" maxlength="24">'
            + '<button class="btn btn-line" id="cGo">' + esc(t('apply')) + '</button></div>')
        + (tt.free > 0
          ? '<div class="meter">'
            + (tt.ship === 0
              ? '<p class="done">' + esc(t('freeNow')) + '</p>'
              : '<p>' + esc(t('freeOverGap', { amount: ils(gap) })) + '</p>')
            + '<div><i style="width:' + Math.min(100, Math.round((tt.sub - tt.off) / tt.free * 100)) + '%"></i></div>'
          + '</div>'
          : '')
        + '<div class="tally"><span>' + esc(t('subtotal')) + '</span><span>' + ils(tt.sub) + '</span></div>'
        + (tt.off > 0
          ? '<div class="tally"><span>' + esc(t('discount')) + '</span><span>− ' + ils(tt.off) + '</span></div>'
          : '')
        + '<div class="tally"><span>' + esc(t('shipping')) + '</span><span>'
          + (tt.ship === 0 ? esc(t('free')) : ils(tt.ship)) + '</span></div>'
        + '<div class="tally sum"><span>' + esc(t('total')) + '</span><span>' + ils(tt.sum) + '</span></div>'
        + '<button class="btn btn-wide" id="toOrder" style="margin-top:13px">' + esc(t('checkout')) + '</button></div>';

      body.querySelectorAll('[data-more]').forEach(function (b) {
        b.addEventListener('click', function () { nudge(b.getAttribute('data-more'), 1); });
      });
      body.querySelectorAll('[data-less]').forEach(function (b) {
        b.addEventListener('click', function () { nudge(b.getAttribute('data-less'), -1); });
      });
      body.querySelectorAll('[data-drop]').forEach(function (b) {
        b.addEventListener('click', function () {
          var key = b.getAttribute('data-drop');
          basket = basket.filter(function (x) { return lineKey(x.id, x.variantId) !== key; });
          keepBasket(); paint(); refreshCart();
        });
      });

      var go = foot.querySelector('#cGo');
      if (go) {
        go.addEventListener('click', function () {
          var code = foot.querySelector('#cCode').value;
          if (!code.trim()) return;
          var off = busy(go, t('moment'));
          api('POST', '/coupon', { code: code, subtotal: totals(lines()).sub })
            .then(function (res) { coupon = res; paint(); toast(t('apply'), 'good'); })
            ['catch'](function (err) { off(); toast(say(err), 'bad'); });
        });
      }
      var drop = foot.querySelector('#dropCoupon');
      if (drop) drop.addEventListener('click', function () { coupon = null; paint(); });

      foot.querySelector('#toOrder').addEventListener('click', function () { sheet.shut(); showOrder(); });

      function nudge(key, by) {
        var entry = basket.filter(function (x) { return lineKey(x.id, x.variantId) === key; })[0];
        if (!entry) return;
        var line = lines().filter(function (l) {
          return lineKey(l.p.id, l.shade ? l.shade.id : null) === key;
        })[0];
        var top = line ? line.ceiling : 1;
        entry.qty = Math.max(1, Math.min(top, entry.qty + by));
        keepBasket(); paint(); refreshCart();
      }
    }
    paint();
  }

  /* ---------- checkout ---------- */

  function showOrder() {
    var ls = lines();
    if (ls.length === 0) { toast(t('emptyBasket'), 'bad'); return; }
    var tt = totals(ls);
    var wa = String(shop.settings.whatsapp || '').replace(/\D/g, '');

    var sheet = openSheet(
      '<div class="sheet-head"><h3>' + esc(t('checkout')) + '</h3>'
      + '<button class="x" data-shut aria-label="' + esc(t('close')) + '">✕</button></div>'
      + '<div class="sheet-body">'
        + '<div id="oErr"></div>'
        + field('oName', t('fullName'), { max: 80, value: me.name, autocomplete: 'name', focus: true })
        + '<div class="two">'
          + field('oPhone', t('phone'), {
            dir: 'ltr', inputmode: 'tel', value: me.phone, placeholder: t('phoneHint'), autocomplete: 'tel',
          })
          + citySelect('oCity', me.city)
        + '</div>'
        + field('oAddr', t('address'), { max: 200, value: me.address, placeholder: t('addressHint') })
        + '<div class="f"><label for="oNote">' + esc(t('notes')) + '</label>'
          + '<textarea id="oNote" maxlength="300" placeholder="' + esc(t('notesHint')) + '"></textarea></div>'
        + '<div style="background:var(--sunken);border:1px solid var(--line);border-radius:var(--r-m);padding:15px">'
          + ls.map(function (l) {
            return '<div class="tally"><span>' + esc(pname(l.p))
              + (l.shade ? ' · ' + esc(shadeName(l.shade)) : '') + ' × ' + l.qty + '</span>'
              + '<span>' + ils(l.p.price * l.qty) + '</span></div>';
          }).join('')
          + (tt.off > 0
            ? '<div class="tally"><span>' + esc(t('discount')) + '</span><span>− ' + ils(tt.off) + '</span></div>'
            : '')
          + '<div class="tally"><span>' + esc(t('shipping')) + '</span><span>'
            + (tt.ship === 0 ? esc(t('free')) : ils(tt.ship)) + '</span></div>'
          + '<div class="tally sum"><span>' + esc(t('total')) + '</span><span>' + ils(tt.sum) + '</span></div>'
        + '</div>'
        + '<p style="margin-top:13px;color:var(--ink-mute);font-size:12.5px">' + esc(t('payOnDelivery')) + '</p>'
      + '</div>'
      + '<div class="sheet-foot"><button class="btn btn-line" data-shut>' + esc(t('back')) + '</button>'
      + '<button class="btn" id="sendOrder">' + esc(t('sendOrder')) + '</button></div>');

    sheet.q('#sendOrder').addEventListener('click', function () {
      var who = {
        customer: sheet.q('#oName').value.trim(),
        phone: sheet.q('#oPhone').value.trim(),
        city: sheet.q('#oCity').value,
        address: sheet.q('#oAddr').value.trim(),
        note: sheet.q('#oNote').value.trim(),
        coupon: coupon ? coupon.code : '',
        items: ls.map(function (l) {
          return { id: l.p.id, variantId: l.shade ? l.shade.id : null, qty: l.qty };
        }),
      };
      var off = busy(sheet.q('#sendOrder'), t('sending'));
      api('POST', '/orders', who).then(function (order) {
        basket = [];
        coupon = null;
        keepBasket();
        sheet.shut();
        // The order is already recorded; WhatsApp is the receipt, not the till.
        if (wa) {
          var msg = [t('orderNo') + ' ' + order.ref + ' — ' + shopName(), '',
            t('fullName') + ': ' + who.customer, t('phone') + ': ' + who.phone,
            t('city') + ': ' + who.city, t('address') + ': ' + who.address];
          if (who.note) msg.push(t('notes') + ': ' + who.note);
          msg.push('');
          order.items.forEach(function (i) {
            msg.push('• ' + pick(i, 'name', 'name_en')
              + (i.variant_name ? ' · ' + i.variant_name : '') + ' × ' + i.qty
              + ' — ' + ils(i.price * i.qty));
          });
          msg.push('');
          if (order.discount > 0) msg.push(t('discount') + ': ' + ils(order.discount));
          msg.push(t('shipping') + ': ' + (order.shipping === 0 ? t('free') : ils(order.shipping)));
          msg.push(t('total') + ': ' + ils(order.total));
          window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(msg.join('\n')), '_blank', 'noopener');
        }
        showThanks(order);
        return load();
      })['catch'](function (err) {
        off();
        sheet.q('#oErr').innerHTML = '<div class="alert">' + esc(say(err)) + '</div>';
      });
    });
  }

  function showThanks(order) {
    openSheet(
      '<div class="sheet-head"><h3>' + esc(t('gotOrder')) + '</h3>'
      + '<button class="x" data-shut aria-label="' + esc(t('close')) + '">✕</button></div>'
      + '<div class="sheet-body"><div class="blank">'
        + '<h4>' + esc(t('thankYou')) + '</h4>'
        + '<p>' + esc(t('orderNo')) + ' <b class="num">' + esc(order.ref) + '</b></p>'
        + '<p style="margin-top:10px">' + esc(t('total')) + ' ' + ils(order.total) + '<br>'
        + esc(t('orderThanks')) + '</p>'
      + '</div></div>'
      + '<div class="sheet-foot"><button class="btn btn-wide" data-shut>' + esc(t('done')) + '</button></div>',
      'sheet-slim');
  }

  /* ---------- photographs ---------- */

  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('read')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('decode')); };
        img.onload = function () {
          var max = 900;
          var k = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * k);
          c.height = Math.round(img.height * k);
          var g = c.getContext('2d');
          g.fillStyle = '#ffffff';
          g.fillRect(0, 0, c.width, c.height);
          g.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.72));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- the product editor ---------- */

  function editProduct(id) {
    if (!owner) return;
    var existing = id ? byId(id) : null;
    var draft = existing
      ? JSON.parse(JSON.stringify(existing))
      : {
        id: 0, cat: shop.categories[0] ? shop.categories[0].slug : '', house: '',
        name: '', name_en: '', blurb: '', blurb_en: '',
        price: 0, was: 0, cost: 0, stock: 0, live: true, pick: false, photos: [], variants: [],
      };
    var startedWith = (existing ? existing.photos : []).slice();
    var shades = (draft.variants || []).slice();

    var sheet = openSheet(
      '<div class="sheet-head"><h3>' + esc(existing ? t('editProduct') : t('newProduct')) + '</h3>'
      + (existing ? '<span class="house">' + esc(existing.sku) + '</span>' : '')
      + '<button class="x" data-shut aria-label="' + esc(t('close')) + '">✕</button></div>'
      + '<div class="sheet-body">'
        + '<div id="eErr"></div>'
        + '<div class="two">'
          + field('eName', t('productName') + ' — ' + t('arabic'), { max: 120, value: draft.name, focus: true })
          + field('eNameEn', t('productName') + ' — ' + t('english'), { max: 120, value: draft.name_en, dir: 'ltr' })
        + '</div>'
        + '<div class="two">'
          + '<div class="f"><label for="eBlurb">' + esc(t('description') + ' — ' + t('arabic')) + '</label>'
            + '<textarea id="eBlurb" maxlength="1200">' + esc(draft.blurb) + '</textarea></div>'
          + '<div class="f"><label for="eBlurbEn">' + esc(t('description') + ' — ' + t('english')) + '</label>'
            + '<textarea id="eBlurbEn" dir="ltr" maxlength="1200">' + esc(draft.blurb_en) + '</textarea></div>'
        + '</div>'
        + '<p class="note" style="color:var(--ink-mute);font-size:12.5px;margin:-8px 0 14px">'
          + esc(t('englishOptional')) + '</p>'
        + '<div class="two">'
          + field('eHouse', t('brand'), { max: 60, value: draft.house, dir: 'ltr' })
          + '<div class="f"><label for="eCat">' + esc(t('section')) + '</label><select id="eCat">'
            + shop.categories.map(function (c) {
              return '<option value="' + esc(c.slug) + '"' + (c.slug === draft.cat ? ' selected' : '') + '>'
                + esc(cname(c)) + '</option>';
            }).join('') + '</select></div>'
        + '</div>'
        + '<div class="three">'
          + field('ePrice', t('sellPrice'), { type: 'number', min: 0, step: '0.5', dir: 'ltr', value: draft.price || '' })
          + field('eWas', t('wasPrice'), { type: 'number', min: 0, step: '0.5', dir: 'ltr', value: draft.was || '' })
          + field('eCost', t('buyCost'), { type: 'number', min: 0, step: '0.1', dir: 'ltr', value: draft.cost || '' })
        + '</div>'
        + '<div id="eMargin"></div>'
        + '<div class="two">'
          + field('eStock', t('quantity'), { type: 'number', min: 0, dir: 'ltr', value: draft.stock || 0 })
          + '<div class="f" style="display:flex;flex-direction:column;justify-content:center;gap:2px">'
            + '<label class="check"><input type="checkbox" id="eLive"' + (draft.live ? ' checked' : '') + '>'
              + '<span class="box"></span><span>' + esc(t('showInShop')) + '</span></label>'
            + '<label class="check"><input type="checkbox" id="ePick"' + (draft.pick ? ' checked' : '') + '>'
              + '<span class="box"></span><span>' + esc(t('featured')) + '</span></label>'
          + '</div>'
        + '</div>'
        + '<div class="f"><span class="flabel">' + esc(t('shades')) + '</span>'
          + '<div id="eShades"></div>'
          + '<button class="btn btn-quiet btn-sm" id="addShade">+ ' + esc(t('add')) + '</button></div>'
        + '<div class="f"><span class="flabel">' + esc(t('photos')) + '</span>'
          + '<div class="drop" id="eDrop" tabindex="0" role="button"><p>' + esc(t('dropPhotos')) + '</p>'
          + '<small>' + esc(t('photoHint')) + '</small></div>'
          + '<input type="file" id="eFile" accept="image/*" multiple hidden>'
          + '<div class="shots" id="eShots"></div></div>'
      + '</div>'
      + '<div class="sheet-foot">'
        + (existing ? '<button class="btn btn-danger" id="eDelete" style="margin-inline-end:auto">'
          + esc(t('remove')) + '</button>' : '')
        + '<button class="btn btn-line" data-shut>' + esc(t('cancel')) + '</button>'
        + '<button class="btn" id="eSave">' + esc(existing ? t('save') : t('add')) + '</button>'
      + '</div>', 'sheet-wide');

    function paintMargin() {
      var price = Number(sheet.q('#ePrice').value) || 0;
      var rate = Number(shop.settings.usdRate) || 3.7;
      var cost = (Number(sheet.q('#eCost').value) || 0) * rate;
      var host = sheet.q('#eMargin');
      if (!price || !cost) { host.innerHTML = ''; return; }
      var gain = price - cost;
      host.innerHTML = '<div class="readout' + (gain <= 0 ? ' warn' : '') + '">'
        + (gain > 0
          ? esc(t('gainEach', { amount: ils(gain), pct: Math.round(gain / price * 100) }))
          : esc(t('belowCost', { amount: ils(cost) }))) + '</div>';
    }
    sheet.q('#ePrice').addEventListener('input', paintMargin);
    sheet.q('#eCost').addEventListener('input', paintMargin);
    paintMargin();

    function paintShades() {
      sheet.q('#eShades').innerHTML = shades.map(function (v, i) {
        return '<div class="shade-row">'
          + '<input type="color" data-sw="' + i + '" value="' + esc(v.swatch || '#c9a0a8') + '">'
          + '<input type="text" data-sn="' + i + '" placeholder="' + esc(t('arabic')) + '" value="' + esc(v.name) + '">'
          + '<input type="text" data-se="' + i + '" dir="ltr" placeholder="' + esc(t('english')) + '" value="'
            + esc(v.name_en || '') + '">'
          + '<input type="number" min="0" data-sq="' + i + '" dir="ltr" value="' + (v.stock || 0) + '">'
          + '<button class="x" data-sx="' + i + '" aria-label="' + esc(t('remove')) + '">✕</button>'
        + '</div>';
      }).join('');
      sheet.q('#eShades').querySelectorAll('[data-sx]').forEach(function (b) {
        b.addEventListener('click', function () {
          shades.splice(Number(b.getAttribute('data-sx')), 1);
          paintShades();
        });
      });
      var bind = function (attr, key, cast) {
        sheet.q('#eShades').querySelectorAll('[' + attr + ']').forEach(function (el) {
          el.addEventListener('input', function () {
            shades[Number(el.getAttribute(attr))][key] = cast ? cast(el.value) : el.value;
          });
        });
      };
      bind('data-sw', 'swatch');
      bind('data-sn', 'name');
      bind('data-se', 'name_en');
      bind('data-sq', 'stock', function (v) { return Math.max(0, parseInt(v, 10) || 0); });
    }
    paintShades();
    sheet.q('#addShade').addEventListener('click', function () {
      shades.push({ id: '', name: '', name_en: '', swatch: '#c9a0a8', stock: 0 });
      paintShades();
    });

    function paintShots() {
      sheet.q('#eShots').innerHTML = draft.photos.map(function (ref, i) {
        return '<div class="mini"><img src="' + esc(photoUrl(ref)) + '" alt="">'
          + '<button data-x="' + i + '" aria-label="' + esc(t('remove')) + '">✕</button>'
          + (i === 0 ? '<em>' + esc(t('main')) + '</em>' : '') + '</div>';
      }).join('');
      sheet.q('#eShots').querySelectorAll('[data-x]').forEach(function (b) {
        b.addEventListener('click', function () {
          draft.photos.splice(Number(b.getAttribute('data-x')), 1);
          paintShots();
        });
      });
    }
    paintShots();

    function takeFiles(list) {
      var files = Array.prototype.slice.call(list)
        .filter(function (f) { return f.type.indexOf('image/') === 0; });
      if (!files.length) return;
      if (draft.photos.length + files.length > 6) { toast(t('tooManyPhotos'), 'bad'); return; }
      var drop = sheet.q('#eDrop');
      var was = drop.innerHTML;
      drop.innerHTML = '<p>' + esc(t('processing')) + '</p>';
      Promise.all(files.map(function (f) {
        return shrink(f)['catch'](function () { return null; });
      })).then(function (urls) {
        urls.forEach(function (u) { if (u) draft.photos.push(u); });
        drop.innerHTML = was;
        paintShots();
      });
    }
    sheet.q('#eDrop').addEventListener('click', function () { sheet.q('#eFile').click(); });
    sheet.q('#eDrop').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sheet.q('#eFile').click(); }
    });
    sheet.q('#eFile').addEventListener('change', function (e) { takeFiles(e.target.files); e.target.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
      sheet.q('#eDrop').addEventListener(ev, function (e) {
        e.preventDefault(); sheet.q('#eDrop').classList.add('over');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      sheet.q('#eDrop').addEventListener(ev, function (e) {
        e.preventDefault();
        sheet.q('#eDrop').classList.remove('over');
        if (ev === 'drop') takeFiles(e.dataTransfer.files);
      });
    });

    var del = sheet.q('#eDelete');
    if (del) del.addEventListener('click', function () {
      if (!confirm(t('deleteAsk', { name: pname(draft) }))) return;
      var off = busy(del, t('moment'));
      api('DELETE', '/products/' + existing.id).then(function () {
        basket = basket.filter(function (b) { return b.id !== existing.id; });
        keepBasket();
        sheet.shut();
        return load();
      }).then(function () { toast(t('productDeleted'), 'good'); })
      ['catch'](function (err) { off(); toast(say(err), 'bad'); });
    });

    sheet.q('#eSave').addEventListener('click', function () {
      var payload = {
        name: sheet.q('#eName').value.trim(),
        name_en: sheet.q('#eNameEn').value.trim(),
        blurb: sheet.q('#eBlurb').value.trim(),
        blurb_en: sheet.q('#eBlurbEn').value.trim(),
        house: sheet.q('#eHouse').value.trim(),
        cat: sheet.q('#eCat').value,
        price: sheet.q('#ePrice').value,
        was: sheet.q('#eWas').value,
        cost: sheet.q('#eCost').value,
        stock: sheet.q('#eStock').value,
        live: sheet.q('#eLive').checked,
        pick: sheet.q('#ePick').checked,
        variants: shades,
      };
      var off = busy(sheet.q('#eSave'), t('saving'));
      var save = existing
        ? api('PATCH', '/products/' + existing.id, payload)
        : api('POST', '/products', payload);

      save.then(function (res) {
        var pid = res.product.id;
        var dropped = startedWith.filter(function (ref) { return draft.photos.indexOf(ref) === -1; });
        var added = draft.photos.filter(function (ref) { return /^data:image\//.test(ref); });
        // One at a time: a photograph is a few hundred kilobytes, and six of
        // them in one request is a body no phone on a slow line will finish.
        return dropped.reduce(function (chain, ref) {
          return chain.then(function () { return api('DELETE', '/photos/' + ref); });
        }, Promise.resolve()).then(function () {
          return added.reduce(function (chain, data) {
            return chain.then(function () {
              return api('POST', '/products/' + pid + '/photos', { data: data });
            });
          }, Promise.resolve());
        });
      }).then(function () {
        sheet.shut();
        return load();
      }).then(function () { toast(t('productSaved'), 'good'); })
      ['catch'](function (err) {
        off();
        sheet.q('#eErr').innerHTML = '<div class="alert">' + esc(say(err)) + '</div>';
      });
    });
  }

  /* ---------- sections ---------- */

  function editSections() {
    if (!owner) return;
    var sheet = openSheet(
      '<div class="sheet-head"><h3>' + esc(t('sections')) + '</h3>'
      + '<button class="x" data-shut aria-label="' + esc(t('close')) + '">✕</button></div>'
      + '<div class="sheet-body">'
        + '<div id="secErr"></div><div id="secList"></div>'
        + '<div style="border-top:1px solid var(--line);margin:18px 0 14px"></div>'
        + '<h4 style="font-family:var(--display);font-weight:500;font-size:17px;margin-bottom:12px">'
          + esc(t('newSection')) + '</h4>'
        + '<div class="two">'
          + field('secName', t('sectionName') + ' — ' + t('arabic'), { max: 60, focus: true })
          + field('secNameEn', t('sectionName') + ' — ' + t('english'), { max: 60, dir: 'ltr' })
        + '</div>'
        + '<div class="two">'
          + field('secKey', t('sectionKey'), { max: 30, dir: 'ltr', note: t('sectionKeyHint') })
          + field('secIcon', t('sectionIcon'), { max: 2, value: '◆' })
        + '</div>'
      + '</div>'
      + '<div class="sheet-foot"><button class="btn btn-line" data-shut>' + esc(t('close')) + '</button>'
      + '<button class="btn" id="secAdd">' + esc(t('add')) + '</button></div>', 'sheet-wide');

    function paint() {
      sheet.q('#secList').innerHTML = '<div class="scroller"><table class="grid-t">'
        + '<tr><th>' + esc(t('sectionName')) + '</th><th>' + esc(t('english')) + '</th>'
        + '<th class="num">' + esc(t('product')) + '</th><th></th></tr>'
        + shop.categories.map(function (c) {
          var n = shop.products.filter(function (p) { return p.cat === c.slug; }).length;
          return '<tr><td>' + esc(c.icon) + ' ' + esc(c.name) + '</td>'
            + '<td dir="ltr">' + esc(c.name_en || '—') + '</td>'
            + '<td class="num">' + n + '</td>'
            + '<td><button class="btn btn-danger btn-sm" data-cat-del="' + esc(c.slug) + '"'
              + (n ? ' disabled' : '') + '>' + esc(t('remove')) + '</button></td></tr>';
        }).join('') + '</table></div>';
      sheet.root.querySelectorAll('[data-cat-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          var off = busy(b, '…');
          api('DELETE', '/categories/' + encodeURIComponent(b.getAttribute('data-cat-del')))
            .then(function () { return load(); })
            .then(function () { shop.categories = shop.categories; paint(); })
            ['catch'](function (err) { off(); toast(say(err), 'bad'); });
        });
      });
    }
    paint();

    sheet.q('#secAdd').addEventListener('click', function () {
      var off = busy(sheet.q('#secAdd'), t('saving'));
      api('POST', '/categories', {
        name: sheet.q('#secName').value,
        name_en: sheet.q('#secNameEn').value,
        slug: sheet.q('#secKey').value,
        icon: sheet.q('#secIcon').value,
      }).then(function () { return load(); })
        .then(function () {
          sheet.q('#secName').value = '';
          sheet.q('#secNameEn').value = '';
          sheet.q('#secKey').value = '';
          off();
          paint();
        })['catch'](function (err) {
          off();
          sheet.q('#secErr').innerHTML = '<div class="alert">' + esc(say(err)) + '</div>';
        });
    });
  }

  /* ---------- discount codes ---------- */

  function editCoupons() {
    if (!owner) return;
    var sheet = openSheet(
      '<div class="sheet-head"><h3>' + esc(t('coupons')) + '</h3>'
      + '<button class="x" data-shut aria-label="' + esc(t('close')) + '">✕</button></div>'
      + '<div class="sheet-body">'
        + '<div id="cpErr"></div><div id="cpList"></div>'
        + '<div style="border-top:1px solid var(--line);margin:18px 0 14px"></div>'
        + '<h4 style="font-family:var(--display);font-weight:500;font-size:17px;margin-bottom:12px">'
          + esc(t('newCoupon')) + '</h4>'
        + '<div class="two">'
          + field('cpCode', t('code'), { max: 24, dir: 'ltr', focus: true })
          + '<div class="f"><label for="cpKind">' + esc(t('kind')) + '</label><select id="cpKind">'
            + '<option value="percent">' + esc(t('percent')) + '</option>'
            + '<option value="amount">' + esc(t('amount')) + '</option></select></div>'
        + '</div>'
        + '<div class="three">'
          + field('cpValue', t('value'), { type: 'number', min: 0, step: '0.5', dir: 'ltr' })
          + field('cpMin', t('minTotal'), { type: 'number', min: 0, dir: 'ltr', value: 0 })
          + field('cpMax', t('maxUses'), { type: 'number', min: 0, dir: 'ltr', value: 0 })
        + '</div>'
        + field('cpExp', t('expires'), { type: 'date', dir: 'ltr' })
      + '</div>'
      + '<div class="sheet-foot"><button class="btn btn-line" data-shut>' + esc(t('close')) + '</button>'
      + '<button class="btn" id="cpAdd">' + esc(t('add')) + '</button></div>', 'sheet-wide');

    function paint(list) {
      var rows = list || (desk ? desk.coupons : []);
      sheet.q('#cpList').innerHTML = rows.length
        ? '<div class="scroller"><table class="grid-t">'
          + '<tr><th>' + esc(t('code')) + '</th><th>' + esc(t('value')) + '</th>'
          + '<th class="num">' + esc(t('minTotal')) + '</th><th class="num">' + esc(t('used')) + '</th>'
          + '<th>' + esc(t('expires')) + '</th><th></th></tr>'
          + rows.map(function (c) {
            return '<tr><td class="num">' + esc(c.code) + '</td>'
              + '<td>' + (c.kind === 'percent' ? c.value + '٪' : ils(c.value)) + '</td>'
              + '<td class="num">' + (c.min_total ? ils(c.min_total) : '—') + '</td>'
              + '<td class="num">' + c.used + (c.max_uses ? ' / ' + c.max_uses : '') + '</td>'
              + '<td>' + (c.expires_at ? esc(c.expires_at) : esc(t('unlimited'))) + '</td>'
              + '<td><button class="btn btn-danger btn-sm" data-cp-del="' + esc(c.code) + '">'
                + esc(t('remove')) + '</button></td></tr>';
          }).join('') + '</table></div>'
        : '<div class="blank" style="padding:26px"><p>' + esc(t('noCoupons')) + '</p></div>';

      sheet.root.querySelectorAll('[data-cp-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          var off = busy(b, '…');
          api('DELETE', '/coupons/' + encodeURIComponent(b.getAttribute('data-cp-del')))
            .then(function (res) { if (desk) desk.coupons = res.coupons; paint(res.coupons); })
            ['catch'](function (err) { off(); toast(say(err), 'bad'); });
        });
      });
    }
    paint();

    sheet.q('#cpAdd').addEventListener('click', function () {
      var off = busy(sheet.q('#cpAdd'), t('saving'));
      api('POST', '/coupons', {
        code: sheet.q('#cpCode').value,
        kind: sheet.q('#cpKind').value,
        value: sheet.q('#cpValue').value,
        min_total: sheet.q('#cpMin').value,
        max_uses: sheet.q('#cpMax').value,
        expires_at: sheet.q('#cpExp').value,
        active: true,
      }).then(function (res) {
        if (desk) desk.coupons = res.coupons;
        sheet.q('#cpCode').value = '';
        sheet.q('#cpValue').value = '';
        off();
        sheet.q('#cpErr').innerHTML = '';
        paint(res.coupons);
      })['catch'](function (err) {
        off();
        sheet.q('#cpErr').innerHTML = '<div class="alert">' + esc(say(err)) + '</div>';
      });
    });
  }

  /* ---------- shop settings ---------- */

  function editSettings() {
    if (!owner) return;
    var s = shop.settings;
    var sheet = openSheet(
      '<div class="sheet-head"><h3>' + esc(t('shopSettings')) + '</h3>'
      + '<button class="x" data-shut aria-label="' + esc(t('close')) + '">✕</button></div>'
      + '<div class="sheet-body">'
        + '<div id="sErr"></div>'
        + '<div class="two">'
          + field('sName', t('shopName') + ' — ' + t('arabic'), { max: 60, value: s.name_ar, focus: true })
          + field('sNameEn', t('shopName') + ' — ' + t('english'), { max: 60, value: s.name_en, dir: 'ltr' })
        + '</div>'
        + '<div class="two">'
          + '<div class="f"><label for="sTag">' + esc(t('shopTagline') + ' — ' + t('arabic')) + '</label>'
            + '<textarea id="sTag" maxlength="300">' + esc(s.tagline_ar) + '</textarea></div>'
          + '<div class="f"><label for="sTagEn">' + esc(t('shopTagline') + ' — ' + t('english')) + '</label>'
            + '<textarea id="sTagEn" dir="ltr" maxlength="300">' + esc(s.tagline_en) + '</textarea></div>'
        + '</div>'
        + '<div class="two">'
          + field('sStrip', t('topStrip') + ' — ' + t('arabic'), { max: 120, value: s.strip_ar })
          + field('sStripEn', t('topStrip') + ' — ' + t('english'), { max: 120, value: s.strip_en, dir: 'ltr' })
        + '</div>'
        + '<div class="two">'
          + field('sWa', t('whatsapp'), { dir: 'ltr', inputmode: 'tel', value: s.whatsapp, note: t('whatsappHint') })
          + field('sIg', t('instagram'), { dir: 'ltr', max: 40, value: s.instagram })
        + '</div>'
        + '<div class="three">'
          + field('sShip', t('deliveryFee'), { type: 'number', min: 0, dir: 'ltr', value: s.shipping })
          + field('sFree', t('freeOver'), { type: 'number', min: 0, dir: 'ltr', value: s.freeOver })
          + field('sDays', t('deliveryDays'), { max: 12, dir: 'ltr', value: s.days || '2 – 4', note: t('daysHint') })
        + '</div>'
        + '<div class="two">'
          + field('sRate', t('usdRate'), {
            type: 'number', min: 0.1, step: '0.01', dir: 'ltr', value: s.usdRate, note: t('usdHint'),
          })
          + '<div class="f"><label for="sLang">' + esc(t('defaultLang')) + '</label><select id="sLang">'
            + '<option value="ar"' + (s.defaultLang === 'ar' ? ' selected' : '') + '>العربية</option>'
            + '<option value="en"' + (s.defaultLang === 'en' ? ' selected' : '') + '>English</option>'
            + '</select></div>'
        + '</div>'
        + '<label class="check"><input type="checkbox" id="sPrivate"'
          + (String(s.private) === '1' ? ' checked' : '') + '>'
          + '<span class="box"></span><span>' + esc(t('privateShop')) + '</span></label>'
      + '</div>'
      + '<div class="sheet-foot"><button class="btn btn-line" data-shut>' + esc(t('cancel')) + '</button>'
      + '<button class="btn" id="sSave">' + esc(t('save')) + '</button></div>', 'sheet-wide');

    sheet.q('#sSave').addEventListener('click', function () {
      var off = busy(sheet.q('#sSave'), t('saving'));
      api('PATCH', '/settings', {
        name_ar: sheet.q('#sName').value,
        name_en: sheet.q('#sNameEn').value,
        tagline_ar: sheet.q('#sTag').value,
        tagline_en: sheet.q('#sTagEn').value,
        strip_ar: sheet.q('#sStrip').value,
        strip_en: sheet.q('#sStripEn').value,
        whatsapp: sheet.q('#sWa').value,
        instagram: sheet.q('#sIg').value,
        shipping: sheet.q('#sShip').value,
        freeOver: sheet.q('#sFree').value,
        days: sheet.q('#sDays').value,
        usdRate: sheet.q('#sRate').value,
        defaultLang: sheet.q('#sLang').value,
        private: sheet.q('#sPrivate').checked,
      }).then(function () {
        sheet.shut();
        return load();
      }).then(function () { toast(t('settingsSaved'), 'good'); })
      ['catch'](function (err) {
        off();
        sheet.q('#sErr').innerHTML = '<div class="alert">' + esc(say(err)) + '</div>';
      });
    });
  }

  /* ================= browsing ================= */

  function shown() {
    var list = shop.products.slice();
    if (filter.loved) list = list.filter(function (p) { return p.loved; });
    if (filter.cat) list = list.filter(function (p) { return p.cat === filter.cat; });
    var q = filter.q.trim().toLowerCase();
    if (q) {
      list = list.filter(function (p) {
        return ((p.name || '') + ' ' + (p.name_en || '') + ' ' + (p.house || '') + ' '
          + (p.blurb || '') + ' ' + (p.blurb_en || '') + ' ' + (p.sku || '')).toLowerCase().indexOf(q) !== -1;
      });
    }
    function off(p) { return p.stock > 0 ? 0 : 1; }
    function disc(p) { return p.was > p.price ? 1 - p.price / p.was : 0; }
    return list.sort(function (a, b) {
      var d = off(a) - off(b);
      if (d) return d;
      if (filter.sort === 'low') return a.price - b.price;
      if (filter.sort === 'high') return b.price - a.price;
      if (filter.sort === 'sale') return disc(b) - disc(a);
      return b.id - a.id;
    });
  }

  function card(p) {
    var sale = p.was > p.price;
    var badges = '';
    if (sale) badges += '<span class="badge">' + esc(t('saveOff', { n: Math.round((1 - p.price / p.was) * 100) })) + '</span>';
    if (p.pick) badges += '<span class="badge badge-pick">' + esc(t('housePick')) + '</span>';
    if (owner && !p.live) badges += '<span class="badge badge-off">' + esc(t('hidden')) + '</span>';

    return '<article class="item' + (owner && !p.live ? ' dim' : '') + '">'
      + (owner ? '' : '<button class="love" data-love="' + p.id + '" aria-pressed="' + p.loved + '"'
        + ' aria-label="' + esc(t('loved')) + '">' + (p.loved ? '♥' : '♡') + '</button>')
      + '<button class="shot" data-open="' + p.id + '" aria-label="' + esc(pname(p)) + '">'
        + facePhoto(p)
        + (badges ? '<span class="badges">' + badges + '</span>' : '')
        + (p.stock <= 0 ? '<span class="veil"><span>' + esc(t('soldOut')) + '</span></span>' : '')
      + '</button>'
      + '<div class="item-body">'
        + (p.house ? '<div class="house">' + esc(p.house) + '</div>' : '')
        + '<h3 class="item-name">' + esc(pname(p)) + '</h3>'
        + (p.variants.length
          ? '<div class="shade-dots">' + p.variants.slice(0, 6).map(function (v) {
            return '<i style="background:' + esc(v.swatch || 'var(--surface-2)') + '"></i>';
          }).join('') + '<span>' + p.variants.length + '</span></div>'
          : '')
        + (p.stock > 0 && p.stock <= 3 ? '<div class="state s-low">' + esc(t('onlyLeft', { n: p.stock })) + '</div>' : '')
        + (owner && p.stock > 3 ? '<div class="state s-ok">' + esc(t('inStore', { n: p.stock })) + '</div>' : '')
        + '<div class="item-foot"><span class="cost"><b class="num">' + ils(p.price) + '</b>'
          + (sale ? '<s class="num">' + ils(p.was) + '</s>' : '') + '</span>'
          + (owner ? '' : '<button class="plus" data-add="' + p.id + '"'
            + (p.stock <= 0 ? ' disabled' : '') + ' aria-label="+">+</button>')
        + '</div>'
      + '</div>'
      + (owner ? '<div class="rowbar"><button class="btn btn-quiet btn-sm" data-edit="' + p.id + '">'
        + esc(t('editProduct')) + '</button></div>' : '')
    + '</article>';
  }

  function renderGrid() {
    var host = document.getElementById('gridHost');
    if (!host) return;
    var list = shown();

    if (!shop.products.length) {
      host.innerHTML = '<div class="first"><div class="mark-big">' + esc(shop.settings.mark || 'د') + '</div>'
        + '<h3>' + esc(t('emptyShop')) + '</h3>'
        + '<p>' + esc(owner ? t('emptyShopOwner') : t('emptyShopCustomer')) + '</p>'
        + (owner ? '<button class="btn" id="firstProduct">' + esc(t('addProduct')) + '</button>' : '')
      + '</div>';
      var first = host.querySelector('#firstProduct');
      if (first) first.addEventListener('click', function () { editProduct(0); });
      return;
    }

    if (!list.length) {
      host.innerHTML = '<div class="blank"><h4>'
        + esc(filter.loved ? t('nothingLoved') : t('noMatch')) + '</h4>'
        + '<p>' + esc(filter.loved ? t('lovedHint') : t('tryAnother')) + '</p></div>';
      return;
    }

    host.innerHTML = '<div class="grid">'
      + (owner ? '<button class="newcard" id="addProduct"><span>+</span><span>'
        + esc(t('addProduct')) + '</span></button>' : '')
      + list.map(card).join('') + '</div>';

    var add = host.querySelector('#addProduct');
    if (add) add.addEventListener('click', function () { editProduct(0); });
    host.querySelectorAll('[data-open]').forEach(function (b) {
      b.addEventListener('click', function () { showProduct(Number(b.getAttribute('data-open'))); });
    });
    host.querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var p = byId(Number(b.getAttribute('data-add')));
        // A product with shades cannot be added blind — open it and let her pick.
        if (p && p.variants.length) { showProduct(p.id); return; }
        addToBasket(p.id, null, 1);
      });
    });
    host.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { editProduct(Number(b.getAttribute('data-edit'))); });
    });
    host.querySelectorAll('[data-love]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = Number(b.getAttribute('data-love'));
        var on = b.getAttribute('aria-pressed') === 'true';
        b.setAttribute('aria-pressed', String(!on));
        b.textContent = on ? '♡' : '♥';
        var p = byId(id);
        if (p) p.loved = !on;
        api(on ? 'DELETE' : 'POST', '/favourites/' + id)['catch'](function (err) {
          b.setAttribute('aria-pressed', String(on));
          b.textContent = on ? '♥' : '♡';
          if (p) p.loved = on;
          toast(say(err), 'bad');
        });
      });
    });
  }

  /* ================= the takings chart ================= */

  /**
   * Fourteen days of takings. One series, so no legend — the heading names it
   * — and only the busiest day carries a figure, because a number over every
   * bar is a table pretending to be a chart.
   */
  function takingsChart(days) {
    var peak = days.reduce(function (m, d) { return Math.max(m, d.total); }, 0);
    var sum = days.reduce(function (s, d) { return s + d.total; }, 0);

    var bars = days.map(function (d) {
      var pct = peak > 0 ? Math.max(d.total > 0 ? 3 : 1.5, (d.total / peak) * 100) : 1.5;
      return '<div class="col' + (d.total > 0 ? '' : ' zero') + '"'
        + ' data-day="' + esc(when(d.day + 'T12:00:00Z')) + '"'
        + ' data-total="' + esc(ils(d.total)) + '"'
        + ' title="' + esc(when(d.day + 'T12:00:00Z') + ' · ' + ils(d.total)) + '">'
        + '<i style="height:' + pct.toFixed(2) + '%"></i></div>';
    }).join('');

    return '<div class="chart" id="chart">'
      + '<div class="chart-top"><b>' + ils(sum) + '</b>'
        + '<span>' + esc(t('takingsTotal')) + '</span>'
        + (sum === 0 ? '<span>· ' + esc(t('noTakings')) + '</span>' : '') + '</div>'
      // Only the busiest day carries a figure; a number over every bar is a
      // table pretending to be a chart.
      + (peak > 0 ? '<div class="chart-peak">' + ils(peak) + '</div>' : '')
      + '<div class="bars" role="img" aria-label="' + esc(t('takings')) + '">' + bars + '</div>'
      + '<div class="chart-base"></div>'
      + '<div class="chart-axis"><span>' + esc(when(days[0].day + 'T12:00:00Z')) + '</span>'
        + '<span>' + esc(when(days[days.length - 1].day + 'T12:00:00Z')) + '</span></div>'
    + '</div>';
  }

  function wireChart() {
    var host = document.getElementById('chart');
    if (!host) return;
    var tip = null;
    host.querySelectorAll('.col').forEach(function (col) {
      var show = function () {
        if (!tip) {
          tip = document.createElement('div');
          tip.className = 'chart-tip';
          host.appendChild(tip);
        }
        tip.innerHTML = esc(col.getAttribute('data-day'))
          + ' · <b>' + esc(col.getAttribute('data-total')) + '</b>';
        tip.style.left = (col.offsetLeft + col.offsetWidth / 2) + 'px';
        tip.style.top = col.offsetTop + 'px';
      };
      var hide = function () { if (tip) { tip.remove(); tip = null; } };
      col.addEventListener('mouseenter', show);
      col.addEventListener('mouseleave', hide);
      col.addEventListener('touchstart', show, { passive: true });
      col.addEventListener('touchend', hide);
    });
  }

  /* ================= the back office ================= */

  function orderCard(o) {
    var next = { new: 'confirmed', confirmed: 'sent', sent: 'delivered' }[o.status];
    var nextWord = { confirmed: 'doConfirm', sent: 'doSent', delivered: 'doDelivered' }[next];
    var wa = String(o.phone || '').replace(/\D/g, '');
    return '<div class="order">'
      + '<div class="order-top">'
        + '<span class="pill pill-' + esc(o.status) + '">' + esc(t(STATUS_WORD[o.status])) + '</span>'
        + '<span class="order-who">' + esc(o.customer) + '</span>'
        + '<span class="order-ref">' + esc(o.ref) + ' · ' + esc(when(o.created_at)) + '</span>'
        + '<span class="order-total">' + ils(o.total) + '</span>'
      + '</div>'
      + '<div class="order-lines">' + o.items.map(function (i) {
        return esc(pick(i, 'name', 'name_en'))
          + (i.variant_name ? ' · ' + esc(i.variant_name) : '') + ' × ' + i.qty;
      }).join(' · ') + '</div>'
      + '<div class="order-where">' + esc(o.city) + ' — ' + esc(o.address)
        + (o.note ? ' · ' + esc(o.note) : '')
        + (o.discount > 0 ? ' · ' + esc(t('discount')) + ' ' + ils(o.discount)
          + (o.coupon_code ? ' (' + esc(o.coupon_code) + ')' : '') : '')
        + (wa ? ' · <a href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">'
          + esc(o.phone) + '</a>' : '') + '</div>'
      + '<div class="order-acts">'
        + (next ? '<button class="btn btn-sm" data-order="' + esc(o.id) + '" data-to="' + next + '">'
          + esc(t(nextWord)) + '</button>' : '')
        + (o.status !== 'cancelled' && o.status !== 'delivered'
          ? '<button class="btn btn-danger btn-sm" data-order="' + esc(o.id) + '" data-to="cancelled">'
            + esc(t('doCancel')) + '</button>'
          : '')
        + (o.status === 'new' ? '<span class="order-ref">' + esc(t('confirmTakesStock')) + '</span>' : '')
      + '</div>'
    + '</div>';
  }

  function firstSteps() {
    var s = shop.settings;
    var steps = [
      { key: 'stepPassword', done: !desk.defaultPassword, act: 'account' },
      { key: 'stepWhatsapp', done: Boolean(String(s.whatsapp || '').replace(/\D/g, '')), act: 'settings' },
      { key: 'stepSection', done: shop.categories.length > 0, act: 'sections' },
      { key: 'stepProduct', done: shop.products.length > 0, act: 'product' },
    ];
    if (steps.every(function (x) { return x.done; })) return '';
    return '<section class="steps"><h3>' + esc(t('firstSteps')) + '</h3>'
      + '<p>' + esc(t('firstStepsNote')) + '</p><ol>'
      + steps.map(function (x) {
        return '<li class="' + (x.done ? 'done' : '') + '">'
          + '<span class="tick">' + (x.done ? '✓' : '') + '</span>'
          + '<span class="grow">' + esc(t(x.key)) + '</span>'
          + (x.done ? '' : '<button class="btn btn-quiet btn-sm" data-step="' + x.act + '">'
            + esc(t('add')) + '</button>')
        + '</li>';
      }).join('') + '</ol></section>';
  }

  function deskPanel() {
    var s = desk.stats;
    var rate = Number(shop.settings.usdRate) || 3.7;
    var watch = shop.products.filter(function (p) { return (p.stock || 0) <= 3; })
      .sort(function (a, b) { return (a.stock || 0) - (b.stock || 0); });
    var open = desk.orders.filter(function (o) {
      return o.status !== 'delivered' && o.status !== 'cancelled';
    });

    return '<section class="desk">'
      + (desk.defaultPassword
        ? '<div class="nag"><span>' + esc(t('passwordNag')) + '</span>'
          + '<button class="btn btn-sm" id="fixPass">' + esc(t('fixNow')) + '</button></div>'
        : '')
      + firstSteps()
      + '<div class="desk-head"><h2>' + esc(t('desk')) + '</h2>'
        + '<p>' + esc(t('rateNote', { rate: rate })) + '</p></div>'
      + '<div class="tiles">'
        + '<div class="tile"><span>' + esc(t('liveProducts')) + '</span><b>' + s.live + '</b>'
          + '<small>' + esc(t('hiddenCount', { n: s.hidden })) + '</small></div>'
        + '<div class="tile"><span>' + esc(t('unitsInStock')) + '</span><b>' + s.units + '</b>'
          + '<small>' + esc(t('kinds', { n: shop.products.length })) + '</small></div>'
        + '<div class="tile"><span>' + esc(t('retailValue')) + '</span><b>' + ils(s.retail) + '</b>'
          + '<small>' + esc(t('atShopPrice')) + '</small></div>'
        + '<div class="tile"><span>' + esc(t('stockCost')) + '</span><b>' + ils(s.cost) + '</b>'
          + '<small>' + esc(t('atCost')) + '</small></div>'
        + '<div class="tile gain"><span>' + esc(t('expectedGain')) + '</span><b>' + ils(s.gain) + '</b>'
          + '<small>' + esc(t('ifAllSold')) + '</small></div>'
        + '<div class="tile ' + (open.length ? 'warn' : '') + '"><span>' + esc(t('openOrders')) + '</span>'
          + '<b>' + open.length + '</b><small>' + esc(t('ofTotal', { n: desk.orders.length })) + '</small></div>'
      + '</div>'

      + '<div class="sheetlike"><h3><span class="grow">' + esc(t('takings')) + '</span></h3>'
        + takingsChart(desk.takings) + '</div>'

      + (desk.orders.length
        ? '<div class="orders"><h3><span class="grow">' + esc(t('orders')) + '</span>'
          + '<span class="order-ref">' + esc(t('needsAction', { n: open.length })) + '</span></h3>'
          + desk.orders.slice(0, 25).map(orderCard).join('') + '</div>'
        : '<div class="orders"><h3>' + esc(t('orders')) + '</h3><div class="blank" style="padding:26px">'
          + '<p>' + esc(t('noOrders')) + ' ' + esc(t('firstOrderHere')) + '</p></div></div>')

      + (watch.length
        ? '<div class="watch"><h3>' + esc(t('lowStock')) + '</h3><ul>'
          + watch.map(function (p) {
            return '<li><span class="state ' + (p.stock > 0 ? 's-low' : 's-gone') + '">'
              + (p.stock > 0 ? esc(t('pieces', { n: p.stock })) : esc(t('ranOut'))) + '</span>'
              + '<span class="grow">' + esc(pname(p)) + '</span>'
              + '<span class="sku">' + esc(p.sku) + '</span>'
              + '<button class="btn btn-quiet btn-sm" data-edit="' + p.id + '">' + esc(t('edit')) + '</button></li>';
          }).join('')
          + '</ul></div>'
        : '')

      + '<div class="sheetlike"><h3><span class="grow">' + esc(t('customers')) + '</span>'
        + '<span class="order-ref">' + desk.customers.length + '</span></h3>'
        + (desk.customers.length
          ? '<div class="scroller"><table class="grid-t"><tr>'
            + '<th>' + esc(t('customer')) + '</th><th>' + esc(t('phone')) + '</th>'
            + '<th>' + esc(t('city')) + '</th><th class="num">' + esc(t('orderCount')) + '</th>'
            + '<th class="num">' + esc(t('spent')) + '</th><th>' + esc(t('joined')) + '</th></tr>'
            + desk.customers.map(function (c) {
              return '<tr><td class="wide">' + esc(c.name) + '<br>'
                + '<span class="order-ref">' + esc(c.email) + '</span></td>'
                + '<td class="num">' + esc(c.phone || '—') + '</td>'
                + '<td>' + esc(c.city || '—') + '</td>'
                + '<td class="num">' + c.orders + '</td>'
                + '<td class="num">' + ils(c.spent) + '</td>'
                + '<td>' + esc(when(c.created_at)) + '</td></tr>';
            }).join('') + '</table></div>'
          : '<div class="blank" style="padding:26px"><p>' + esc(t('noCustomers')) + '</p></div>')
      + '</div>'
    + '</section>';
  }

  function bandPanel() {
    var s = shop.settings;
    return '<section class="band">'
      + '<div><h2>' + esc(shopTag()) + '</h2>'
        + '<p>' + esc(t('pickedByUs')) + '</p></div>'
      + '<div class="facts">'
        + '<div class="fact"><b>' + shop.products.length + '</b><span>' + esc(t('itemsInShop')) + '</span></div>'
        + '<div class="fact"><b>' + esc(s.days || '2 – 4') + '</b><span>' + esc(t('daysToDoor')) + '</span></div>'
        + (Number(s.freeOver) > 0
          ? '<div class="fact"><b>' + ils(s.freeOver) + '</b><span>' + esc(t('freeAbove')) + '</span></div>'
          : '')
      + '</div>'
    + '</section>';
  }

  function langSwitch() {
    return '<span class="langs">'
      + '<button data-lang="ar" aria-pressed="' + (lang === 'ar') + '">ع</button>'
      + '<button data-lang="en" aria-pressed="' + (lang === 'en') + '">EN</button>'
      + '</span>';
  }

  function wireLangs() {
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
    });
  }

  /* ================= render ================= */

  function render() {
    if (shop.locked && !me) { renderDoor(); return; }

    var s = shop.settings;
    var n = count();
    var lovedCount = shop.products.filter(function (p) { return p.loved; }).length;

    app.innerHTML =
      '<header>'
        + (shopStrip() && !owner ? '<div class="strip">' + esc(shopStrip()) + '</div>' : '')
        + '<div class="masthead' + (owner ? ' admin' : '') + '"><div class="shell masthead-row">'
          + '<button class="mark" id="mark" aria-label="' + esc(shopName()) + '">'
            + esc(s.mark || 'د') + '</button>'
          + '<div class="wordmark"><h1>' + esc(shopName()) + '</h1>'
            + '<span>' + esc(owner ? t('adminMode') : (otherName() || t('doorFoot'))) + '</span></div>'
          + '<div class="mast-actions">'
            + langSwitch()
            + (owner
              ? '<button class="btn btn-line btn-sm" id="openSections">' + esc(t('sections')) + '</button>'
                + '<button class="btn btn-line btn-sm" id="openCoupons">' + esc(t('coupons')) + '</button>'
                + '<button class="btn btn-line btn-sm" id="openSettings">' + esc(t('settings')) + '</button>'
                + '<button class="btn btn-line btn-sm" id="signOut">' + esc(t('signOut')) + '</button>'
              : '<button class="btn btn-line btn-sm" id="openMine">' + esc(t('myOrders')) + '</button>'
                + '<button class="btn btn-line btn-sm" id="openProfile">' + esc(t('myAccount')) + '</button>'
                + '<button class="btn btn-line btn-sm" id="signOut">' + esc(t('signOut')) + '</button>'
                + '<button class="btn btn-line btn-sm cart" id="openCart">' + esc(t('cart'))
                  + '<span id="cartCount">' + (n ? '<b class="num">' + n + '</b>' : '') + '</span></button>')
          + '</div>'
        + '</div><div class="nacre"></div></div>'
      + '</header>'

      + '<main>'
        + '<div class="shell">' + (owner ? deskPanel() : bandPanel()) + '</div>'
        + '<div class="index"><div class="shell index-row">'
          + '<div class="find"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" '
            + 'stroke="currentColor" stroke-width="1.7" aria-hidden="true">'
            + '<circle cx="7" cy="7" r="4.6"></circle><path d="M10.5 10.5L14 14"></path></svg>'
            + '<input id="q" type="search" placeholder="' + esc(t('search')) + '" '
            + 'value="' + esc(filter.q) + '" aria-label="' + esc(t('search')) + '"></div>'
          + '<div class="sortbox"><label class="sr" for="sort">' + esc(t('sortBy')) + '</label>'
            + '<select id="sort">'
            + SORTS.map(function (k) {
              return '<option value="' + k + '"' + (filter.sort === k ? ' selected' : '') + '>'
                + esc(t(SORT_WORD[k])) + '</option>';
            }).join('') + '</select></div>'
        + '</div>'
        + '<div class="shell"><nav class="rail" id="rail" aria-label="' + esc(t('sections')) + '">'
          + '<button class="chip" data-cat="" aria-pressed="' + (filter.cat === '' && !filter.loved) + '">'
            + esc(t('all')) + ' <small>' + shop.products.length + '</small></button>'
          + (!owner && lovedCount
            ? '<button class="chip" data-loved="1" aria-pressed="' + filter.loved + '">♥ '
              + esc(t('loved')) + ' <small>' + lovedCount + '</small></button>'
            : '')
          + shop.categories.map(function (c) {
            var k = shop.products.filter(function (p) { return p.cat === c.slug; }).length;
            if (!k && !owner) return '';
            return '<button class="chip" data-cat="' + esc(c.slug) + '" aria-pressed="'
              + (filter.cat === c.slug) + '">'
              + '<i aria-hidden="true">' + esc(c.icon) + '</i>' + esc(cname(c))
              + ' <small>' + k + '</small></button>';
          }).join('')
        + '</nav></div></div>'
        + '<div class="shell" id="gridHost"></div>'
      + '</main>'

      + '<footer class="foot"><div class="shell">'
        + '<div class="foot-row">'
          + '<div style="max-width:46ch"><h4>' + esc(shopName()) + '</h4><p>' + esc(shopTag()) + '</p></div>'
          + '<div><h4>' + esc(t('contactUs')) + '</h4>'
            + (s.whatsapp
              ? '<p><a href="https://wa.me/' + esc(String(s.whatsapp).replace(/\D/g, ''))
                + '" target="_blank" rel="noopener">' + esc(t('whatsapp')) + ' ' + esc(s.whatsapp) + '</a></p>'
              : '<p>' + esc(t('noWhatsapp')) + '</p>')
            + (s.instagram
              ? '<p><a href="https://instagram.com/' + esc(s.instagram)
                + '" target="_blank" rel="noopener">@' + esc(s.instagram) + '</a></p>'
              : '')
            + '<p>' + esc(t('codPalestine')) + '</p>'
          + '</div>'
        + '</div>'
        + '<div class="foot-end"><span>© ' + new Date().getFullYear() + ' ' + esc(shopName()) + '</span>'
          + '<span>' + esc(t('madeIn')) + '</span>'
        + '</div>'
      + '</div></footer>';

    renderGrid();
    wire();
    wireChart();
  }

  function wire() {
    var on = function (id, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    on('openSettings', editSettings);
    on('openSections', editSections);
    on('openCoupons', editCoupons);
    on('openProfile', editProfile);
    on('openMine', showMyOrders);
    on('openCart', showBasket);
    on('signOut', signOut);
    on('fixPass', editProfile);

    document.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-step');
        if (act === 'account') editProfile();
        else if (act === 'settings') editSettings();
        else if (act === 'sections') editSections();
        else editProduct(0);
      });
    });

    document.querySelectorAll('.watch [data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { editProduct(Number(b.getAttribute('data-edit'))); });
    });

    document.querySelectorAll('[data-order]').forEach(function (b) {
      b.addEventListener('click', function () {
        var off = busy(b, '…');
        api('PATCH', '/orders/' + b.getAttribute('data-order'), { status: b.getAttribute('data-to') })
          .then(function () { return load(); })
          .then(function () { toast(t('orderUpdated'), 'good'); })
          ['catch'](function (err) { off(); toast(say(err), 'bad'); });
      });
    });

    var q = document.getElementById('q');
    var pause;
    q.addEventListener('input', function () {
      filter.q = q.value;
      clearTimeout(pause);
      // The field itself is never rebuilt, so the caret stays where it was.
      pause = setTimeout(renderGrid, 130);
    });

    document.getElementById('sort').addEventListener('change', function (e) {
      filter.sort = e.target.value;
      renderGrid();
    });

    var chips = document.querySelectorAll('#rail [data-cat], #rail [data-loved]');
    chips.forEach(function (b) {
      b.addEventListener('click', function () {
        filter.loved = b.hasAttribute('data-loved');
        filter.cat = b.hasAttribute('data-cat') ? b.getAttribute('data-cat') : '';
        chips.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        renderGrid();
      });
    });

    wireLangs();
  }

  load();
})();

