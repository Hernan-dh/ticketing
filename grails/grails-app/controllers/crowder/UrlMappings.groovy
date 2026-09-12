package crowder
class UrlMappings {
    static mappings = {
        '/api/events'(controller: 'event') { action = [GET: 'index', POST: 'save'] }
    }
}
