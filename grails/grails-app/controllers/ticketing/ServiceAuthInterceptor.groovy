package ticketing
import java.security.MessageDigest
class ServiceAuthInterceptor {
    ServiceAuthInterceptor() { matchAll() }
    boolean before() {
        String expected = System.getenv('SERVICE_KEY')
        String actual = request.getHeader('X-Service-Key') ?: ''
        if (!expected || !MessageDigest.isEqual(expected.getBytes('UTF-8'), actual.getBytes('UTF-8'))) {
            render status: 401, contentType: 'application/json', text: '{"error":"Unauthorized"}'
            return false
        }
        true
    }
}
