import sys
from pathlib import Path

import pytest
from werkzeug.security import generate_password_hash

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import Product, Store, User, create_app, db

@pytest.fixture()
def client(tmp_path):
    app = create_app({'TESTING': True, 'SQLALCHEMY_DATABASE_URI': f'sqlite:///{tmp_path / "test.db"}', 'SECRET_KEY': 'test-secret', 'SESSION_COOKIE_SECURE': False})
    with app.test_client() as client:
        yield client
    with app.app_context():
        db.drop_all()

def csrf(client):
    return client.get('/api/csrf').get_json()['token']

def test_register_login_and_shipping_quote(client):
    response = client.post('/api/auth/register', json={'name': 'Buyer', 'email': 'buyer@example.com', 'password': 'a-secure-password', 'role': 'customer'})
    assert response.status_code == 201
    assert client.get('/api/me').get_json()['role'] == 'customer'
    quote = client.post('/api/shipping/quote', json={'weight_lb': 2, 'length_in': 10, 'width_in': 10, 'height_in': 10, 'destination_zip': '78701'})
    assert quote.status_code == 200
    assert quote.get_json()['origin'].endswith('78705')

def test_mutation_requires_csrf(client):
    client.post('/api/auth/register', json={'name': 'Buyer', 'email': 'buyer2@example.com', 'password': 'a-secure-password', 'role': 'customer'})
    response = client.post('/api/cart/items', json={'product_id': 1, 'quantity': 1})
    assert response.status_code == 400

def test_checkout_uses_server_shipping_and_stays_pending_until_paid(client):
    client.post('/api/auth/register', json={'name': 'Buyer', 'email': 'checkout@example.com', 'password': 'a-secure-password'})
    with client.application.app_context():
        seller = User(email='seller@example.com', name='Seller', role='seller', password_hash=generate_password_hash('a-secure-password'))
        seller.store = Store(name='Seller store')
        seller.store.products.append(Product(name='Test product', price_cents=2500, inventory=5))
        db.session.add(seller)
        db.session.commit()
        product_id = seller.store.products[0].id

    token = csrf(client)
    add_to_cart = client.post(
        '/api/cart/items',
        json={'product_id': product_id, 'quantity': 2},
        headers={'X-CSRF-Token': token},
    )
    assert add_to_cart.status_code == 200

    response = client.post(
        '/api/checkout',
        json={'shipping_address': '123 Example Street, Austin, TX 78701', 'shipping_cents': 1},
        headers={'X-CSRF-Token': token},
    )
    assert response.status_code == 201
    order = response.get_json()['order']
    assert order['status'] == 'pending'
    assert order['shipping'] == '$10.90'

    with client.application.app_context():
        product = db.session.get(Product, product_id)
        assert product.inventory == 5

    seller_client = client.application.test_client()
    login = seller_client.post('/api/auth/login', json={'email': 'seller@example.com', 'password': 'a-secure-password'})
    assert login.status_code == 200
    fulfill = seller_client.post(
        f"/api/seller/orders/{order['id']}/fulfill",
        headers={'X-CSRF-Token': login.get_json()['csrf']},
    )
    assert fulfill.status_code == 409
    assert fulfill.get_json()['error'] == 'payment_required'

    cancel = client.post(
        f"/api/orders/{order['id']}/cancel",
        headers={'X-CSRF-Token': token},
    )
    assert cancel.status_code == 200
    with client.application.app_context():
        product = db.session.get(Product, product_id)
        assert product.inventory == 5
