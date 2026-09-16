package ticketing
import javax.sql.DataSource
import groovy.sql.Sql
import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import org.springframework.beans.factory.annotation.Autowired
class CatalogService {
    @Autowired
    DataSource dataSource
    List list() {
        new Sql(dataSource).rows('SELECT payload FROM catalog_events ORDER BY created_at, id').collect {
            new JsonSlurper().parseText(it.payload.toString())
        }
    }
    void save(Map event) {
        new Sql(dataSource).executeInsert('INSERT INTO catalog_events (id, payload) VALUES (?, ?)', [event.id, JsonOutput.toJson(event)])
    }
}
