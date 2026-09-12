package crowder
import groovy.json.JsonOutput
class EventController {
    CatalogService catalogService
    static allowedMethods = [index: 'GET', save: 'POST']
    def index() { render contentType: 'application/json', text: JsonOutput.toJson(catalogService.list()) }
    def save() {
        Map body = request.JSON as Map
        if (!(body.name instanceof String) || !body.name.trim() || body.name.size() > 120 ||
            !(body.venue instanceof String) || !body.venue.trim() || body.venue.size() > 200 ||
            !(body.price instanceof Number) || body.price < 0 || body.price > 10000000 || body.price != body.price.intValue() ||
            !(body.rows instanceof Number) || body.rows < 1 || body.rows > 20 || body.rows != body.rows.intValue() ||
            !(body.columns instanceof Number) || body.columns < 1 || body.columns > 20 || body.columns != body.columns.intValue() ||
            !(body.medium in ['Digital', 'Papel', 'RFID'])) {
            render status: 400, contentType: 'application/json', text: '{"error":"Invalid event"}'; return
        }
        try { java.time.LocalDateTime.parse(body.date as String) } catch (Exception ignored) {
            render status: 400, contentType: 'application/json', text: '{"error":"Invalid date"}'; return
        }
        Map event = [id: UUID.randomUUID().toString(), name: body.name.trim(), venue: body.venue.trim(),
            date: body.date, price: body.price.intValue(), rows: body.rows.intValue(), columns: body.columns.intValue(),
            medium: body.medium, category: 'Evento', accent: 'lime']
        catalogService.save(event)
        render status: 201, contentType: 'application/json', text: JsonOutput.toJson(event)
    }
}
