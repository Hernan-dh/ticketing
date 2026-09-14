import {test,expect} from '@playwright/test';
test('catalog, Pixi map, checkout, QR, and single admission',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('heading',{name:'Tus eventos, sin límites.'})).toBeVisible();
 await page.screenshot({path:'test-results/catalog-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Ver Horizonte Festival'}).click();await expect(page.locator('canvas')).toBeVisible();
 await page.getByText('Selección accesible de asientos').click();await page.locator('.seat-buttons button:not([disabled])').first().click();
 await page.getByRole('button',{name:'Reservar por 5 minutos'}).click();await page.getByLabel('Correo del comprador').fill('browser@example.com');
 await page.getByRole('button',{name:'Simular pago y emitir'}).click();await expect(page.getByRole('heading',{name:'¡Ya tenés tus entradas!'})).toBeVisible();
 await expect(page.getByRole('img',{name:/QR de entrada/})).toBeVisible();const token=await page.locator('.ticket code').textContent();
 await page.getByRole('button',{name:'Control de acceso',exact:false}).click();await page.getByLabel('Clave de operador').fill('browser-test-key');await page.getByRole('button',{name:'Ingresar / actualizar'}).click();await expect(page.getByText('Sesión verificada')).toBeVisible();
 await page.getByRole('combobox',{name:'Evento',exact:true}).selectOption('e1');await page.getByLabel('Código de entrada').fill(token);await page.getByRole('button',{name:'Validar ingreso'}).click();await expect(page.getByRole('status')).toContainText('Acceso permitido');
 await page.getByLabel('Código de entrada').fill(token);await page.getByRole('button',{name:'Validar ingreso'}).click();await expect(page.getByRole('alert')).toContainText('ya fue utilizada');
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Eventos',exact:false}).click();await page.screenshot({path:'test-results/catalog-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
