<?php
// Inclui o cabeçalho da página
include 'header.php';

// Define a página padrão como 'home'
$page = isset($_GET['page']) ? $_GET['page'] : 'home';

// Define o caminho para a pasta de templates
$template_path = 'page-templates/';

// Constrói o caminho completo para o arquivo da página
$file = $template_path . $page . '.php';

// Verifica se o arquivo da página existe e o inclui.
// Se não existir, inclui a página de erro 404 (que podemos criar depois).
if (file_exists($file)) {
    include $file;
} else {
    // Simples fallback para a home se a página não for encontrada
    echo "<h2>Página não encontrada</h2>";
    echo "<p>A página que você está procurando não existe. <a href='index.php'>Voltar para a Home</a>.</p>";
    include $template_path . 'home.php';
}

// Inclui o rodapé da página
include 'footer.php';
?>
