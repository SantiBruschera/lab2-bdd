# Informe — Laboratorio 2: Base de Datos Orientada a Documentos
## ING0250 — Base de Datos III

---

## 1. Descripción general de la aplicación

Se desarrolló **UMDB** (*University Movie Database*), una plataforma web de reseñas de películas inspirada en IMDB. La aplicación permite explorar un catálogo de 1 320 películas, leer y escribir reseñas con calificaciones del 1 al 10, buscar por título, director o actor, consultar un ranking general o filtrado por género, y gestionar una lista de favoritos personal mediante un sistema de registro e inicio de sesión.

### 1.1 Componentes

| Capa | Tecnología | Función |
|---|---|---|
| Frontend | React 18 + Vite | Interfaz de usuario SPA |
| Backend | Node.js + Express | API REST |
| Base de datos | MongoDB | Persistencia |
| ODM | Mongoose | Mapeo objeto-documento |
| Infraestructura | Docker Compose | Orquestación de contenedores |

La comunicación entre frontend y backend se realiza mediante HTTP/JSON. El backend expone cuatro grupos de rutas: `/api/movies`, `/api/reviews`, `/api/auth` y `/api/favorites`.

### 1.2 Páginas de la aplicación

- **Inicio** — grilla de películas con filtro por género y paginación.
- **Ranking** — lista ordenada de mayor a menor calificación, filtrable por género.
- **Búsqueda** — resultados relevantes usando búsqueda de texto completo de MongoDB.
- **Detalle de película** — información completa, reparto, promedio de calificación y sección de reseñas con paginación.
- **Favoritos** — lista personalizada de películas guardadas (requiere sesión iniciada).
- **Registro / Inicio de sesión** — autenticación de usuarios.

---

## 2. Diseño de la base de datos

La base de datos se llama `umdb` y contiene tres colecciones: `movies`, `reviewbuckets` y `users`.

### 2.1 Colección `movies`

Cada documento representa una película. Se almacenan datos propios de la película y, de forma **embebida**, el reparto de actores.

```json
{
  "_id": ObjectId("..."),
  "title": "The Shawshank Redemption",
  "year": 1994,
  "genres": ["Drama"],
  "director": "Frank Darabont",
  "actors": [
    { "name": "Tim Robbins", "character": "Andy Dufresne" },
    { "name": "Morgan Freeman", "character": "Ellis Boyd 'Red' Redding" }
  ],
  "imdb_id": "tt0111161",
  "plot": "Two imprisoned men bond over a number of years...",
  "runtime": 142,
  "avg_rating": 9.3,
  "review_count": 48,
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

**Decisión de diseño — actores embebidos:**
Los actores se guardan dentro del documento de la película en lugar de en una colección separada. Esto permite obtener toda la información de una película —incluyendo el reparto— en una sola consulta, sin necesidad de hacer *joins*. La limitación impuesta es de 100 actores por película, valor más que suficiente para el dominio de la aplicación.

**Decisión de diseño — desnormalización de `avg_rating` y `review_count`:**
Estos dos campos se calculan y guardan directamente en el documento de la película cada vez que se agrega una reseña. Esto evita recalcular el promedio en cada consulta, lo cual sería costoso si se necesitara recorrer todos los buckets de reseñas. Es un patrón de desnormalización intencional: se acepta cierta redundancia a cambio de lecturas muy rápidas, especialmente importante para la página de ranking donde se ordenan 1 320 películas por calificación.

**Índices definidos en `movies`:**

| Índice | Tipo | Uso |
|---|---|---|
| `avg_rating: -1` | Simple descendente | Ranking y listado ordenado |
| `genres: 1` | Simple sobre array | Filtro por género |
| `title`, `director`, `actors.name` | Texto compuesto | Búsqueda de texto completo |

### 2.2 Colección `reviewbuckets` — Bucket Pattern

Las reseñas se almacenan usando el **Bucket Pattern** (patrón de balde), técnica sugerida por el docente para manejar el crecimiento ilimitado de datos dentro de documentos MongoDB.

**El problema:** MongoDB tiene un límite de 16 MB por documento. Si todas las reseñas de una película se guardaran embebidas dentro del documento de la película, dicho límite se alcanzaría con pocas miles de reseñas extensas.

**La solución:** En lugar de un único documento con todas las reseñas, se usan múltiples documentos *balde*, cada uno conteniendo hasta **1 000 reseñas**. Una película puede tener hasta **5 baldes** (5 000 reseñas en total).

```json
{
  "_id": ObjectId("..."),
  "movie_id": ObjectId("..."),
  "bucket": 1,
  "count": 1000,
  "reviews": [
    {
      "author": "usuario123",
      "rating": 9,
      "text": "Una obra maestra del cine.",
      "date": ISODate("2024-03-15")
    },
    ...
  ]
}
```

**Índice definido en `reviewbuckets`:**

| Índice | Tipo | Uso |
|---|---|---|
| `{ movie_id: 1, bucket: 1 }` | Compuesto único | Identificar el balde correcto al insertar |

**Lógica de inserción:** Al agregar una reseña, el sistema busca el último balde de esa película. Si tiene menos de 1 000 reseñas, agrega la nueva reseña con `$push`. Si está lleno, crea un nuevo balde con número de balde incrementado. Luego recalcula `avg_rating` y `review_count` en el documento de la película.

**Ventajas del Bucket Pattern frente a documentos planos:**
- Evita superar el límite de 16 MB por documento.
- Mantiene las reseñas agrupadas por película, lo que es más eficiente que tener una colección separada de reseñas individuales (un documento por reseña).
- El índice compuesto `movie_id + bucket` permite localizar rápidamente el balde correcto.

### 2.3 Colección `users`

```json
{
  "_id": ObjectId("..."),
  "username": "santi",
  "password": "$2b$10$...",
  "favorites": [
    ObjectId("..."),
    ObjectId("...")
  ],
  "createdAt": ISODate("..."),
  "updatedAt": ISODate("...")
}
```

**Decisión de diseño — favoritos como array de referencias:**
El campo `favorites` es un array de `ObjectId` que referencian documentos en la colección `movies`. A diferencia de los actores —que se embeben porque son datos estáticos e intrínsecos de la película—, los favoritos son una relación dinámica entre usuario y película, y referenciar es más apropiado aquí. Al consultar los favoritos, se usa `Model.find({ _id: { $in: user.favorites } })`, que obtiene los documentos completos en una sola operación.

**Seguridad:** La contraseña nunca se guarda en texto plano. Se hashea con **bcryptjs** (factor de costo 10) antes de persistirla. La autenticación usa tokens **JWT** con expiración de 7 días.

---

## 3. Comparación con una base de datos relacional (SQL)

Para dimensionar las decisiones tomadas, es útil comparar el diseño MongoDB con el equivalente en SQL.

### 3.1 Modelo relacional equivalente

En SQL, el mismo dominio requeriría al menos las siguientes tablas:

```
movies (id, title, year, director, imdb_id, plot, runtime, avg_rating, review_count)
genres (id, name)
movie_genres (movie_id, genre_id)          -- tabla intermedia
actors (id, name)
movie_actors (movie_id, actor_id, character)  -- tabla intermedia
reviews (id, movie_id, user_id, author, rating, text, date)
users (id, username, password_hash)
user_favorites (user_id, movie_id)         -- tabla intermedia
```

### 3.2 Diferencias clave

| Aspecto | MongoDB (UMDB) | SQL equivalente |
|---|---|---|
| Actores | Array embebido en `movies` | Tablas `actors` + `movie_actors` + JOIN |
| Géneros | Array de strings en `movies` | Tablas `genres` + `movie_genres` + JOIN |
| Reseñas | Bucket Pattern: array en balde | Tabla `reviews` con fila por reseña |
| Favoritos | Array de `ObjectId` en `users` | Tabla `user_favorites` (relación N:M) |
| Promedio | Campo `avg_rating` en `movies` | Calculado con `AVG()` en cada consulta |
| Schema | Flexible, sin migraciones | Estricto, migraciones para cambios |

### 3.3 Ventajas observadas del modelo documental

- **Consulta de película completa:** Un único `Movie.findById(id)` devuelve título, géneros, director y reparto sin ningún JOIN.
- **Ranking:** `Movie.find().sort({ avg_rating: -1 })` sobre un campo indexado es extremadamente rápido porque `avg_rating` está desnormalizado.
- **Búsqueda de texto:** El índice de texto de MongoDB cubre título, director y nombre de actores en un solo índice compuesto; en SQL requeriría `FULLTEXT` sobre múltiples tablas o una solución externa como Elasticsearch.

### 3.4 Desventajas del modelo documental

- **Consistencia de datos:** Si el nombre de un actor cambia, hay que actualizar todos los documentos que lo contengan embebido. En SQL basta con actualizar una fila en la tabla `actors`.
- **Consultas relacionales complejas:** Obtener "todas las películas en las que actuó X actor y que tengan más de Y reseñas" requiere más lógica de aplicación en MongoDB que un simple JOIN con `WHERE`.
- **Actualizaciones de reseñas:** El Bucket Pattern complica la edición o eliminación de una reseña individual, ya que hay que localizarla dentro del array del balde correcto.

---

## 4. Funcionalidad adicional: sistema de usuarios y favoritos

Como funcionalidad adicional al catálogo base, se implementó un **sistema completo de autenticación y lista de favoritos**.

### 4.1 Registro e inicio de sesión

- **Registro:** el usuario elige un nombre de usuario (3–30 caracteres, único) y una contraseña. La contraseña se hashea con bcryptjs antes de guardarse.
- **Inicio de sesión:** se verifica el hash con `bcrypt.compare()`. Si es correcto, se genera un token JWT firmado con una clave secreta.
- **Sesión persistente:** el token se guarda en `localStorage` del navegador y se incluye en el encabezado `Authorization: Bearer <token>` de las solicitudes protegidas. Al recargar la página, el frontend verifica el token llamando a `GET /api/auth/me`.

### 4.2 Reseñas con usuario autenticado

Cuando el usuario tiene sesión iniciada y escribe una reseña, el formulario oculta el campo de nombre y muestra "Publicando como [username]". El backend decodifica el token y usa `req.user.username` como autor, ignorando cualquier nombre que pudiera venir en el cuerpo de la solicitud.

### 4.3 Lista de favoritos

- El ícono de favoritos (♡ / ♥) aparece en la página de detalle de cada película.
- Si el usuario no tiene sesión, al presionarlo es redirigido al inicio de sesión.
- Con sesión activa, el botón agrega o quita la película del array `favorites` del usuario mediante `POST /api/favorites/:id` o `DELETE /api/favorites/:id`.
- El enlace "Favoritos" en la barra de navegación es siempre visible: si el usuario no tiene sesión, la página lo redirige al login.
- La página de favoritos obtiene los datos completos de las películas con `Movie.find({ _id: { $in: user.favorites } })`.

### 4.4 Rutas de la API de autenticación y favoritos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | No | Crear cuenta |
| POST | `/api/auth/login` | No | Iniciar sesión |
| GET | `/api/auth/me` | JWT | Verificar token |
| GET | `/api/favorites` | JWT | Listar favoritos |
| GET | `/api/favorites/check/:id` | JWT | Verificar si una película es favorita |
| POST | `/api/favorites/:id` | JWT | Agregar favorito |
| DELETE | `/api/favorites/:id` | JWT | Quitar favorito |

---

## 5. Proceso de carga inicial de datos (seed)

El dataset original es un archivo CSV con 1 320 películas y sus reseñas. El script de seed (`seed.js`) se ejecuta automáticamente al levantar el contenedor de backend si la colección `movies` está vacía.

El proceso:
1. Lee el CSV con `csv-parser` usando la opción `escape: '\\'` para manejar el formato de escape no estándar del archivo.
2. Por cada fila, parsea los campos JSON (géneros, actores, reseñas).
3. Las calificaciones originales del CSV estaban en escala 0–5; se multiplican por 2 para convertirlas a escala 0–10.
4. Inserta las películas con `Movie.insertMany()`.
5. Agrupa las reseñas en baldes de 1 000 y los inserta con `ReviewBucket.insertMany()`.
6. El resultado final es: **1 320 películas** y **17 856 reseñas** distribuidas en buckets.

---

## 6. Conclusiones

La construcción de UMDB permitió aplicar de forma práctica los principales conceptos de diseño con MongoDB:

- **Documentos embebidos vs referencias:** se eligió embeber actores y géneros (datos estáticos y de lectura frecuente) y referenciar favoritos (relación dinámica usuario-película).
- **Bucket Pattern:** resuelve el problema de crecimiento ilimitado de reseñas sin superar el límite de 16 MB por documento, manteniendo las reseñas agrupadas por película.
- **Desnormalización:** guardar `avg_rating` y `review_count` en el documento de película elimina cálculos costosos en las lecturas, a cambio de una escritura adicional al insertar reseñas.
- **Índices:** el índice descendente en `avg_rating` hace eficiente el ranking; el índice de texto permite búsqueda full-text sin herramientas externas.

El sistema de usuarios y favoritos demostró cómo MongoDB permite agregar funcionalidades con esquemas flexibles sin necesidad de migraciones complejas, a la vez que plantea desafíos de consistencia que en SQL estarían resueltos por las restricciones relacionales.
