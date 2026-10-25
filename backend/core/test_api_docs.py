"""The API documentation: the OpenAPI schema and the Swagger UI are public and describe the API."""

from django.test import TestCase
from rest_framework.test import APIClient


class ApiDocsTest(TestCase):
    def test_schema_describes_the_api_and_both_logins(self):
        response = APIClient().get('/api/schema/', HTTP_ACCEPT='application/vnd.oai.openapi+json')
        self.assertEqual(response.status_code, 200)
        schema = response.json()
        for path in ['/api/assets/', '/api/downtime/', '/api/line-states/', '/api/auth/login/']:
            self.assertIn(path, schema['paths'])
        self.assertEqual(set(schema['components']['securitySchemes']), {'cookieAuth', 'tokenAuth'})

    def test_swagger_ui_is_served_without_a_cdn(self):
        response = APIClient().get('/api/docs/')
        self.assertEqual(response.status_code, 200)
        page = response.content.decode()
        self.assertIn('swagger-ui', page)
        self.assertNotIn('cdn.jsdelivr.net', page)
