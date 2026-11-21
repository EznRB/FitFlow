const test=require('node:test'),assert=require('node:assert/strict');
const {readBricksConfig}=require('../src/services/mercado-pago.adapter');
const env={MP_SANDBOX_ENABLED:'true',MP_SANDBOX_WEBHOOK_SECRET:'s'.repeat(40),MP_SANDBOX_PUBLIC_URL:'https://fitflow.example',MP_BRICKS_TEST_ACCESS_TOKEN:'TEST-private',MP_BRICKS_TEST_PUBLIC_KEY:'TEST-public',MP_BRICKS_TEST_SELLER_ID:'123',MP_BRICKS_TEST_BUYER_EMAIL:'checkout@example.com'};
test('Bricks exige credenciais TEST e email sintetico fora das contas de teste',()=>{assert.equal(readBricksConfig(env).enabled,true); for(const changed of [{MP_BRICKS_TEST_ACCESS_TOKEN:'APP_USR-fake'},{MP_BRICKS_TEST_PUBLIC_KEY:'APP_USR-fake'},{MP_BRICKS_TEST_BUYER_EMAIL:'test_user_buyer@testuser.com'},{MP_BRICKS_TEST_ACCESS_TOKEN:undefined}])assert.equal(readBricksConfig({...env,...changed}).enabled,false);});

test('Bricks permite segredo de assinatura automatico separado do simulador',()=>{const c=readBricksConfig({...env,MP_BRICKS_WEBHOOK_SECRET:'p'.repeat(64)});assert.equal(c.secret,'p'.repeat(64));assert.equal(env.MP_SANDBOX_WEBHOOK_SECRET,'s'.repeat(40));});
