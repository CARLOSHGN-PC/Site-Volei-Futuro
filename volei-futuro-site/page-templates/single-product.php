<section id="single-product-page">
    <?php
    // Simulação de um banco de dados de produtos
    $products = [
        [
            'id' => 1,
            'name' => 'Camisa Oficial do Time (Azul)',
            'price' => 'R$ 89,90',
            'image' => 'assets/images/placeholder_camisa_azul.png',
            'slug' => 'camisa-oficial-azul',
            'description' => '<p>Mostre seu apoio com a camisa oficial do Volei Futuro! Feita com tecido tecnológico que absorve o suor e mantém você confortável.</p><p>Disponível nos tamanhos P, M, G e GG.</p>'
        ],
        [
            'id' => 2,
            'name' => 'Camisa Oficial do Time (Branca)',
            'price' => 'R$ 89,90',
            'image' => 'assets/images/placeholder_camisa_branca.png',
            'slug' => 'camisa-oficial-branca',
            'description' => '<p>A versão branca da nossa camisa oficial. Perfeita para os jogos fora de casa. Mesmo tecido de alta performance.</p><p>Disponível nos tamanhos P, M, G e GG.</p>'
        ],
        [
            'id' => 3,
            'name' => 'Boné Volei Futuro',
            'price' => 'R$ 49,90',
            'image' => 'assets/images/placeholder_bone.png',
            'slug' => 'bone-volei-futuro',
            'description' => '<p>Proteja-se do sol com estilo. Nosso boné tem o logo do time bordado na frente e um ajuste regulável na parte de trás.</p>'
        ],
        [
            'id' => 4,
            'name' => 'Garrafa de Água Personalizada',
            'price' => 'R$ 35,00',
            'image' => 'assets/images/placeholder_garrafa.png',
            'slug' => 'garrafa-agua',
            'description' => '<p>Mantenha-se hidratado durante os treinos e jogos. Garrafa de 750ml com o logo do Volei Futuro.</p>'
        ]
    ];

    $product_found = null;
    if (isset($_GET['slug'])) {
        $slug = $_GET['slug'];
        foreach ($products as $product) {
            if ($product['slug'] === $slug) {
                $product_found = $product;
                break;
            }
        }
    }

    if ($product_found) {
        echo '<div class="product-image-column">';
        echo '<img src="' . htmlspecialchars($product_found['image']) . '" alt="' . htmlspecialchars($product_found['name']) . '">';
        echo '</div>';
        echo '<div class="product-details-column">';
        echo '<h2>' . htmlspecialchars($product_found['name']) . '</h2>';
        echo '<p class="price">' . htmlspecialchars($product_found['price']) . '</p>';
        echo '<div class="description">' . $product_found['description'] . '</div>';
        echo '<a href="index.php?page=cart&action=add&id=' . $product_found['id'] . '" class="add-to-cart-button">Adicionar ao Carrinho</a>';
        echo '<br><a href="index.php?page=loja" style="margin-top: 20px; display:inline-block;">&larr; Voltar para a loja</a>';
        echo '</div>';
    } else {
        echo '<h2>Produto não encontrado</h2>';
        echo '<p>O produto que você está procurando não foi encontrado. <a href="index.php?page=loja">Voltar para a loja</a>.</p>';
    }
    ?>
</section>
