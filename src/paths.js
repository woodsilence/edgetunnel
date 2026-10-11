/**
 * 伪装路径生成
 *
 * `随机路径` 从 267 词表中无偏抽取 1~3 段，拼成对外不易猜的接入路径。
 * `替换星号为随机字符` 处理优选 IP 配置里以 `*` 表示随机段的占位写法。
 *
 * 本模块不依赖任何其他模块，是干净的叶子。
 */

const 常用路径常量 = ["about", "account", "acg", "act", "activity", "ad", "ads", "ajax", "album", "albums", "anime", "api", "app", "apps", "archive", "archives", "article", "articles", "ask", "auth", "avatar", "bbs", "bd", "blog", "blogs", "book", "books", "bt", "buy", "cart", "category", "categories", "cb", "channel", "channels", "chat", "china", "city", "class", "classify", "clip", "clips", "club", "cn", "code", "collect", "collection", "comic", "comics", "community", "company", "config", "contact", "content", "course", "courses", "cp", "data", "detail", "details", "dh", "directory", "discount", "discuss", "dl", "dload", "doc", "docs", "document", "documents", "doujin", "download", "downloads", "drama", "edu", "en", "ep", "episode", "episodes", "event", "events", "f", "faq", "favorite", "favourites", "favs", "feedback", "file", "files", "film", "films", "forum", "forums", "friend", "friends", "game", "games", "gif", "go", "go.html", "go.php", "group", "groups", "help", "home", "hot", "htm", "html", "image", "images", "img", "index", "info", "intro", "item", "items", "ja", "jp", "jump", "jump.html", "jump.php", "jumping", "knowledge", "lang", "lesson", "lessons", "lib", "library", "link", "links", "list", "live", "lives", "m", "mag", "magnet", "mall", "manhua", "map", "member", "members", "message", "messages", "mobile", "movie", "movies", "music", "my", "new", "news", "note", "novel", "novels", "online", "order", "out", "out.html", "out.php", "outbound", "p", "page", "pages", "pay", "payment", "pdf", "photo", "photos", "pic", "pics", "picture", "pictures", "play", "player", "playlist", "post", "posts", "product", "products", "program", "programs", "project", "qa", "question", "rank", "ranking", "read", "readme", "redirect", "redirect.html", "redirect.php", "reg", "register", "res", "resource", "retrieve", "sale", "search", "season", "seasons", "section", "seller", "series", "service", "services", "setting", "settings", "share", "shop", "show", "shows", "site", "soft", "sort", "source", "special", "star", "stars", "static", "stock", "store", "stream", "streaming", "streams", "student", "study", "tag", "tags", "task", "teacher", "team", "tech", "temp", "test", "thread", "tool", "tools", "topic", "topics", "torrent", "trade", "travel", "tv", "txt", "type", "u", "upload", "uploads", "url", "urls", "user", "users", "v", "version", "videos", "view", "vip", "vod", "watch", "web", "wenku", "wiki", "work", "www", "zh", "zh-cn", "zh-tw", "zip"];

function 随机路径(完整节点路径 = "/") {
	const 随机数 = Math.floor(Math.random() * 3 + 1);
	// 部分 Fisher-Yates：在词表副本上只洗前 随机数 步（O(随机数)），取前 随机数 个词。
	// 标准算法，分布严格无偏；原实现对整表 sort(() => 0.5 - Math.random()) 既慢又明显有偏。
	const 洗牌 = 常用路径常量.slice();
	for (let i = 0; i < 随机数; i++) {
		const j = i + Math.floor(Math.random() * (洗牌.length - i));
		[洗牌[i], 洗牌[j]] = [洗牌[j], 洗牌[i]];
	}
	const 随机路径 = 洗牌.slice(0, 随机数).join('/');
	if (完整节点路径 === "/") return `/${随机路径}`;
	else return `/${随机路径 + 完整节点路径.replace('/?', '?')}`;
}

function 替换星号为随机字符(内容) {
	if (typeof 内容 !== 'string' || !内容.includes('*')) return 内容;
	const 字符集 = 'abcdefghijklmnopqrstuvwxyz0123456789';
	return 内容.replace(/\*/g, () => {
		let s = '';
		for (let i = 0; i < Math.floor(Math.random() * 14) + 3; i++) s += 字符集[Math.floor(Math.random() * 字符集.length)];
		return s;
	});
}

export { 常用路径常量, 随机路径, 替换星号为随机字符 };
