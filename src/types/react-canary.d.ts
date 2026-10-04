// The app router runs on the React that ships inside Next (19.x), not the
// 18.x in package.json, so hooks like useActionState and useFormStatus are
// there at runtime. These pull in their types.
/// <reference types="react/canary" />
/// <reference types="react-dom/canary" />
